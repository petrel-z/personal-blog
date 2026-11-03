import { randomUUID } from 'crypto'
import type { ImageUploadTask, ImageUploadPart } from '@prisma/client'
import { prisma } from '@/server/db'
import { storageConfig } from '@/shared/config/storage'
import { IMAGE_PART_SIZE, partRange, type UploadTaskResult } from '@/shared/image-upload'
import { getImageStorage, imageExtension } from './upload-storage'
import { UploadError, InvalidStoredPartError, sha256, validateUploadManifest, verifyImageSignature } from './upload-validation'

type Task = ImageUploadTask & { parts: ImageUploadPart[] }
const include = { parts: { orderBy: { partNumber: 'asc' as const } } }
const retention = 7 * 24 * 60 * 60 * 1000
const completionLease = 10 * 60 * 1000

function result(task: Task): UploadTaskResult {
  return { uploadId: task.id, partSize: task.partSize, totalParts: task.totalParts,
    uploadedParts: task.parts.map(part => part.partNumber), status: task.status, url: task.url }
}

async function ownedTask(userId: string, id: string): Promise<Task> {
  const task = await prisma.imageUploadTask.findFirst({ where: { id, userId, provider: storageConfig.provider }, include })
  if (!task) throw new UploadError('上传任务不存在', 404)
  if (task.status !== 'COMPLETED' && (task.expiresAt <= new Date() || task.status === 'EXPIRED')) throw new UploadError('上传任务已过期，请重新选择图片', 410)
  return task
}

export async function createImageUpload(userId: string, input: unknown): Promise<UploadTaskResult> {
  const manifest = validateUploadManifest(input)
  const provider = storageConfig.provider
  const storage = getImageStorage(provider)
  const existing = await prisma.imageUploadTask.findFirst({
    where: { userId, fileHash: manifest.fileHash, provider, OR: [
      { status: 'COMPLETED' }, { status: { in: ['UPLOADING', 'COMPLETING'] }, expiresAt: { gt: new Date() } },
    ] }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], include,
  })
  if (existing) {
    if (existing.status !== 'COMPLETED' || await storage.exists(existing)) return result(existing)
    await prisma.imageUploadTask.updateMany({ where: { id: existing.id, status: 'COMPLETED' }, data: { status: 'EXPIRED', url: null } })
  }
  const id = randomUUID()
  const objectKey = `${id}.${imageExtension(manifest.type)}`
  const remoteUploadId = await storage.init(objectKey, manifest.type, manifest.fileHash)
  try {
    const task = await prisma.imageUploadTask.create({ data: {
      id, userId, fileHash: manifest.fileHash, fileSize: manifest.size, fileType: manifest.type,
      partSize: IMAGE_PART_SIZE, totalParts: manifest.totalParts, partHashes: manifest.hashes,
      provider, objectKey, remoteUploadId, expiresAt: new Date(Date.now() + retention),
    }, include })
    return result(task)
  } catch (error) {
    await storage.discard({ id, objectKey, remoteUploadId, fileSize: manifest.size, fileType: manifest.type, fileHash: manifest.fileHash }).catch(() => {})
    throw error
  }
}

export async function getImageUpload(userId: string, id: string) { return result(await ownedTask(userId, id)) }

export async function uploadImagePart(userId: string, id: string, partNumber: number, bytes: Buffer) {
  const task = await ownedTask(userId, id)
  let expectedSize: number
  try { expectedSize = partRange(task.fileSize, partNumber).size }
  catch { throw new UploadError('无效的分片编号') }
  if (bytes.length !== expectedSize) throw new UploadError('分片大小不匹配')
  const hash = sha256(bytes)
  if (hash !== (task.partHashes as string[])[partNumber - 1]) throw new UploadError('分片内容校验失败')
  if (partNumber === 1) verifyImageSignature(bytes, task.fileType)
  const existing = task.parts.find(part => part.partNumber === partNumber)
  if (existing) {
    if (existing.hash !== hash || existing.size !== bytes.length) throw new UploadError('分片内容冲突', 409)
    return { partNumber }
  }
  if (task.status !== 'UPLOADING') throw new UploadError('上传任务正在处理，请稍后重试', 409, true)
  const etag = await getImageStorage(task.provider).putPart(task, partNumber, bytes)
  // The immutable manifest guarantees concurrent retries contain identical bytes.
  await prisma.imageUploadPart.upsert({ where: { uploadId_partNumber: { uploadId: id, partNumber } },
    create: { uploadId: id, partNumber, hash, size: bytes.length, etag }, update: { hash, size: bytes.length, etag } })
  return { partNumber }
}

export async function completeImageUpload(userId: string, id: string) {
  const task = await ownedTask(userId, id)
  if (task.status === 'COMPLETED' && task.url) return { url: task.url }
  const hashes = task.partHashes as string[]
  const parts = new Map(task.parts.map(part => [part.partNumber, part]))
  for (let number = 1; number <= task.totalParts; number++) {
    const part = parts.get(number)
    if (!part || part.hash !== hashes[number - 1] || part.size !== partRange(task.fileSize, number).size) {
      throw new UploadError('分片尚未收齐，请继续上传', 409)
    }
  }
  const token = randomUUID()
  const acquired = await prisma.imageUploadTask.updateMany({ where: { id, userId, expiresAt: { gt: new Date() }, OR: [
    { status: 'UPLOADING' }, { status: 'COMPLETING', leaseUntil: { lt: new Date() } },
  ] }, data: { status: 'COMPLETING', completeToken: token, leaseUntil: new Date(Date.now() + completionLease) } })
  if (!acquired.count) throw new UploadError('图片正在处理，请稍后重试', 409, true)
  const storage = getImageStorage(task.provider)
  try {
    const url = await storage.complete(task, task.parts)
    const saved = await prisma.imageUploadTask.updateMany({ where: { id, status: 'COMPLETING', completeToken: token },
      data: { status: 'COMPLETED', url, completeToken: null, leaseUntil: null } })
    if (!saved.count) throw new UploadError('图片正在处理，请稍后重试', 409, true)
    await storage.cleanParts(task).catch(() => {})
    return { url }
  } catch (error) {
    if (error instanceof InvalidStoredPartError) {
      await prisma.imageUploadPart.deleteMany({ where: { uploadId: id, partNumber: error.partNumber } })
    }
    await prisma.imageUploadTask.updateMany({ where: { id, status: 'COMPLETING', completeToken: token },
      data: { status: 'UPLOADING', completeToken: null, leaseUntil: null } }).catch(() => {})
    throw error
  }
}

export async function cleanupImageUploads() {
  const now = new Date()
  const tasks = await prisma.imageUploadTask.findMany({ where: { OR: [
    { status: 'EXPIRED' }, { status: 'UPLOADING', expiresAt: { lte: now } },
    { status: 'COMPLETING', expiresAt: { lte: now }, leaseUntil: { lt: now } },
  ] }, take: 100 })
  let cleaned = 0
  for (const task of tasks) {
    const claimed = await prisma.imageUploadTask.updateMany({ where: { id: task.id, status: task.status, updatedAt: task.updatedAt }, data: { status: 'EXPIRED' } })
    if (!claimed.count) continue
    await getImageStorage(task.provider).discard(task)
    await prisma.imageUploadTask.deleteMany({ where: { id: task.id, status: 'EXPIRED' } })
    cleaned++
  }
  return cleaned
}

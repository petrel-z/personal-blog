import OSS from 'ali-oss'
import { createHash, randomUUID } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, rename, rm, stat, writeFile } from 'fs/promises'
import path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { storageConfig } from '@/shared/config/storage'
import { UploadError, InvalidStoredPartError, sha256 } from './upload-validation'

export type StorageTask = {
  id: string; objectKey: string; remoteUploadId: string | null
  fileSize: number; fileType: string; fileHash: string
}
export type StoredPart = { partNumber: number; size: number; hash: string; etag: string }
export interface ImageStorage {
  init(objectKey: string, type: string, fingerprint: string): Promise<string | null>
  putPart(task: StorageTask, number: number, bytes: Buffer): Promise<string>
  complete(task: StorageTask, parts: StoredPart[]): Promise<string>
  exists(task: StorageTask): Promise<boolean>
  discard(task: StorageTask): Promise<void>
  cleanParts(task: StorageTask): Promise<void>
  putImage(objectKey: string, bytes: Buffer, type: string): Promise<string>
}

export const imageExtension = (type: string) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }[type] || 'bin')
const missing = (error: unknown) => ['ENOENT', 'NoSuchKey', 'NoSuchUpload'].includes((error as { code?: string })?.code || '') || (error as { status?: number })?.status === 404

export class LocalImageStorage implements ImageStorage {
  constructor(private root = process.cwd()) {}
  private parts(task: StorageTask) { return path.join(this.root, '.data', 'image-uploads', task.id) }
  private target(task: Pick<StorageTask, 'objectKey'>) { return path.join(this.root, 'public', 'uploads', task.objectKey) }
  async init() { return null }
  async putPart(task: StorageTask, number: number, bytes: Buffer) {
    const directory = this.parts(task)
    await mkdir(directory, { recursive: true })
    const temporary = path.join(directory, `${number}.${randomUUID()}.tmp`)
    try {
      await writeFile(temporary, bytes)
      await rename(temporary, path.join(directory, String(number)))
    } finally { await rm(temporary, { force: true }) }
    return sha256(bytes)
  }
  async exists(task: StorageTask) {
    try { return (await stat(this.target(task))).size === task.fileSize }
    catch (error) { if (missing(error)) return false; throw error }
  }
  async complete(task: StorageTask, parts: StoredPart[]) {
    if (await this.exists(task)) return `/uploads/${task.objectKey}`
    const target = this.target(task)
    await mkdir(path.dirname(target), { recursive: true })
    // Hidden temporary files are never a successful image URL. Publish by rename.
    const temporary = path.join(this.parts(task), `${randomUUID()}.merged`)
    const directory = this.parts(task)
    async function* readParts() {
      let total = 0
      for (const part of [...parts].sort((a, b) => a.partNumber - b.partNumber)) {
        const digest = createHash('sha256')
        let size = 0
        try {
          for await (const chunk of createReadStream(path.join(directory, String(part.partNumber)))) {
            const bytes = chunk as Buffer
            size += bytes.length; digest.update(bytes)
            yield bytes
          }
        } catch (error) { if (missing(error)) throw new InvalidStoredPartError(part.partNumber); throw error }
        if (size !== part.size || digest.digest('hex') !== part.hash) throw new InvalidStoredPartError(part.partNumber)
        total += size
      }
      if (total !== task.fileSize) throw new UploadError('文件大小不匹配', 409)
    }
    try {
      await pipeline(Readable.from(readParts()), createWriteStream(temporary, { flags: 'wx' }))
      await rename(temporary, target)
    } finally { await rm(temporary, { force: true }) }
    return `/uploads/${task.objectKey}`
  }
  async cleanParts(task: StorageTask) { await rm(this.parts(task), { recursive: true, force: true }) }
  async discard(task: StorageTask) {
    await this.cleanParts(task)
    await rm(this.target(task), { force: true })
  }
  async putImage(objectKey: string, bytes: Buffer) {
    const target = this.target({ objectKey })
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, bytes, { flag: 'wx' })
    return `/uploads/${objectKey}`
  }
}

export class OssImageStorage implements ImageStorage {
  constructor(private client: OSS) {}
  private url(key: string) { return this.client.generateObjectUrl(key, storageConfig.oss.cdnDomain || undefined) }
  async init(objectKey: string, type: string, fingerprint: string) {
    return (await this.client.initMultipartUpload(objectKey, { mime: type, headers: { 'x-oss-meta-fingerprint': fingerprint } })).uploadId
  }
  async putPart(task: StorageTask, number: number, bytes: Buffer) {
    if (!task.remoteUploadId) throw new Error('Missing OSS upload ID')
    return (await this.client.uploadPart(task.objectKey, task.remoteUploadId, number, bytes, 0, bytes.length)).etag
  }
  async exists(task: StorageTask) {
    try {
      const result = await this.client.head(task.objectKey)
      const headers = result.res.headers as Record<string, string>
      return Number(headers['content-length']) === task.fileSize && headers['x-oss-meta-fingerprint'] === task.fileHash
    } catch (error) { if (missing(error)) return false; throw error }
  }
  async complete(task: StorageTask, parts: StoredPart[]) {
    // Recovers a successful completion whose response/database update was lost.
    if (!(await this.exists(task))) {
      if (!task.remoteUploadId) throw new Error('Missing OSS upload ID')
      await this.client.completeMultipartUpload(task.objectKey, task.remoteUploadId,
        [...parts].sort((a, b) => a.partNumber - b.partNumber).map(part => ({ number: part.partNumber, etag: part.etag })))
    }
    return this.url(task.objectKey)
  }
  async cleanParts() { /* OSS releases parts when CompleteMultipartUpload succeeds. */ }
  async discard(task: StorageTask) {
    if (task.remoteUploadId) {
      try { await this.client.abortMultipartUpload(task.objectKey, task.remoteUploadId) }
      catch (error) { if (!missing(error)) throw error }
    }
    await this.client.delete(task.objectKey)
  }
  async putImage(objectKey: string, bytes: Buffer, type: string) {
    await this.client.put(objectKey, bytes, { mime: type })
    return this.url(objectKey)
  }
}

export function getImageStorage(provider = storageConfig.provider): ImageStorage {
  if (provider === 'local') return new LocalImageStorage()
  if (provider !== 'oss') throw new Error('Unknown image storage provider')
  const { accessKeyId, accessKeySecret, bucket, region, endpoint } = storageConfig.oss
  return new OssImageStorage(new OSS({ accessKeyId, accessKeySecret, bucket, region, secure: true, ...(endpoint ? { endpoint } : {}) }))
}

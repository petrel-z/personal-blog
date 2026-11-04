jest.mock('@/server/db', () => ({ prisma: {
  imageUploadTask: { findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
  imageUploadPart: { upsert: jest.fn(), deleteMany: jest.fn() },
} }))
jest.mock('@/server/features/upload/upload-storage', () => ({
  ...jest.requireActual('@/server/features/upload/upload-storage'), getImageStorage: jest.fn(),
}))

import { prisma } from '@/server/db'
import { getImageStorage } from '@/server/features/upload/upload-storage'
import { createImageUpload, getImageUpload, uploadImagePart, completeImageUpload } from '@/server/features/upload/upload.service'
import { IMAGE_PART_SIZE, manifestPayload } from '@/shared/image-upload'
import { sha256, InvalidStoredPartError } from '@/server/features/upload/upload-validation'

const bytes = Buffer.alloc(IMAGE_PART_SIZE)
Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes)
const hashes = [sha256(bytes), sha256(bytes)]
const manifest = { size: IMAGE_PART_SIZE * 2, type: 'image/png', hashes, fileHash: sha256(manifestPayload(IMAGE_PART_SIZE * 2, hashes)) }
const makeTask = () => ({ id: 'task-id', userId: 'owner', fileHash: manifest.fileHash, fileSize: manifest.size, fileType: 'image/png',
  partSize: IMAGE_PART_SIZE, totalParts: 2, partHashes: hashes, provider: 'local', objectKey: 'test.png', remoteUploadId: null,
  status: 'UPLOADING', url: null, leaseUntil: null, completeToken: null, expiresAt: new Date(Date.now() + 60000), parts: [] as unknown[] })
const storage = { init: jest.fn(), putPart: jest.fn(), complete: jest.fn(), exists: jest.fn(), discard: jest.fn(), cleanParts: jest.fn() }
beforeEach(() => {
  jest.resetAllMocks()
  ;(getImageStorage as jest.Mock).mockReturnValue(storage)
  storage.init.mockResolvedValue(null); storage.putPart.mockResolvedValue('etag'); storage.complete.mockResolvedValue('/uploads/test.png')
  storage.exists.mockResolvedValue(true); storage.cleanParts.mockResolvedValue(undefined)
  ;(prisma.imageUploadTask.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
})

test('resume lookup returns confirmed parts and completed owned images become instant uploads', async () => {
  const task = { ...makeTask(), parts: [{ partNumber: 2 }] }
  ;(prisma.imageUploadTask.findFirst as jest.Mock).mockResolvedValue(task)
  expect(await createImageUpload('owner', manifest)).toMatchObject({ uploadId: 'task-id', uploadedParts: [2], url: null })
  ;(prisma.imageUploadTask.findFirst as jest.Mock).mockResolvedValue({ ...task, status: 'COMPLETED', url: '/uploads/test.png' })
  expect(await createImageUpload('owner', manifest)).toMatchObject({ status: 'COMPLETED', url: '/uploads/test.png' })
})

test('an upload belonging to another user is inaccessible', async () => {
  ;(prisma.imageUploadTask.findFirst as jest.Mock).mockResolvedValue(null)
  await expect(getImageUpload('other', 'task-id')).rejects.toMatchObject({ status: 404 })
  expect(storage.putPart).not.toHaveBeenCalled()
})

test('wrong lengths, numbers, hashes and forged image signatures cannot create a successful part', async () => {
  ;(prisma.imageUploadTask.findFirst as jest.Mock).mockResolvedValue(makeTask())
  await expect(uploadImagePart('owner', 'task-id', 0, bytes)).rejects.toMatchObject({ status: 400 })
  await expect(uploadImagePart('owner', 'task-id', 1, Buffer.from('small'))).rejects.toMatchObject({ status: 400 })
  await expect(uploadImagePart('owner', 'task-id', 1, Buffer.alloc(IMAGE_PART_SIZE))).rejects.toMatchObject({ status: 400 })
  const bad = Buffer.alloc(IMAGE_PART_SIZE)
  ;(prisma.imageUploadTask.findFirst as jest.Mock).mockResolvedValue({ ...makeTask(), partHashes: [sha256(bad), hashes[1]] })
  await expect(uploadImagePart('owner', 'task-id', 1, bad)).rejects.toMatchObject({ status: 400 })
  expect(storage.putPart).not.toHaveBeenCalled()
})

test('lost database confirmation is recoverable by re-uploading identical part content', async () => {
  const task = makeTask()
  ;(prisma.imageUploadTask.findFirst as jest.Mock).mockResolvedValue(task)
  ;(prisma.imageUploadPart.upsert as jest.Mock).mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValueOnce({})
  await expect(uploadImagePart('owner', 'task-id', 1, bytes)).rejects.toThrow('database unavailable')
  expect(await uploadImagePart('owner', 'task-id', 1, bytes)).toEqual({ partNumber: 1 })
})

test('an already confirmed part is idempotent and does not need another storage write', async () => {
  ;(prisma.imageUploadTask.findFirst as jest.Mock).mockResolvedValue({ ...makeTask(), parts: [{ partNumber: 1, size: bytes.length, hash: hashes[0], etag: 'etag' }] })
  expect(await uploadImagePart('owner', 'task-id', 1, bytes)).toEqual({ partNumber: 1 })
  expect(storage.putPart).not.toHaveBeenCalled()
})

test('missing parts prevent completion; unordered complete parts produce a reusable result', async () => {
  const task = makeTask()
  ;(prisma.imageUploadTask.findFirst as jest.Mock).mockResolvedValue(task)
  await expect(completeImageUpload('owner', 'task-id')).rejects.toMatchObject({ status: 409 })
  expect(storage.complete).not.toHaveBeenCalled()
  const parts = [2, 1].map(number => ({ partNumber: number, size: bytes.length, hash: hashes[number - 1], etag: `etag-${number}` }))
  ;(prisma.imageUploadTask.findFirst as jest.Mock).mockResolvedValue({ ...task, parts })
  expect(await completeImageUpload('owner', 'task-id')).toEqual({ url: '/uploads/test.png' })
  ;(prisma.imageUploadTask.findFirst as jest.Mock).mockResolvedValue({ ...task, status: 'COMPLETED', url: '/uploads/test.png' })
  expect(await completeImageUpload('owner', 'task-id')).toEqual({ url: '/uploads/test.png' })
})

test('an active completion lease prevents two callers merging the same upload', async () => {
  ;(prisma.imageUploadTask.findFirst as jest.Mock).mockResolvedValue({ ...makeTask(), parts: [1, 2].map(partNumber => ({ partNumber, size: bytes.length, hash: hashes[partNumber - 1], etag: 'etag' })) })
  ;(prisma.imageUploadTask.updateMany as jest.Mock).mockResolvedValue({ count: 0 })
  await expect(completeImageUpload('owner', 'task-id')).rejects.toMatchObject({ status: 409, retryable: true })
  expect(storage.complete).not.toHaveBeenCalled()
})

test('a damaged local part loses its confirmation so that selecting the same file can repair it', async () => {
  const task = { ...makeTask(), parts: [1, 2].map(partNumber => ({ partNumber, size: bytes.length, hash: hashes[partNumber - 1], etag: 'etag' })) }
  ;(prisma.imageUploadTask.findFirst as jest.Mock).mockResolvedValue(task)
  ;(prisma.imageUploadPart.deleteMany as jest.Mock).mockImplementation(({ where }) => {
    task.parts = task.parts.filter(part => part.partNumber !== where.partNumber)
    return Promise.resolve({ count: 1 })
  })
  storage.complete.mockRejectedValue(new InvalidStoredPartError(2))
  await expect(completeImageUpload('owner', 'task-id')).rejects.toMatchObject({ status: 409 })
  expect(await getImageUpload('owner', 'task-id')).toMatchObject({ uploadedParts: [1] })
  expect(await uploadImagePart('owner', 'task-id', 2, bytes)).toEqual({ partNumber: 2 })
})

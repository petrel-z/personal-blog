import { mkdtemp, readFile, rm, stat } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { createHash } from 'crypto'
import OSS from 'ali-oss'
import { LocalImageStorage, OssImageStorage } from '@/server/features/upload/upload-storage'

const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex')
let root: string
beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'blog-image-upload-')) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

test('local parts remain private, merge in numbered order and publish only the complete image', async () => {
  const storage = new LocalImageStorage(root)
  const task = { id: 'test-task', objectKey: 'image.png', remoteUploadId: null, fileSize: 6, fileType: 'image/png', fileHash: 'fingerprint' }
  const one = Buffer.from('abc'), two = Buffer.from('def')
  await storage.putPart(task, 2, two)
  await storage.putPart(task, 1, one)
  await expect(stat(path.join(root, 'public/uploads/image.png'))).rejects.toMatchObject({ code: 'ENOENT' })
  const parts = [{ partNumber: 2, size: 3, hash: hash(two), etag: hash(two) }, { partNumber: 1, size: 3, hash: hash(one), etag: hash(one) }]
  expect(await storage.complete(task, parts)).toBe('/uploads/image.png')
  expect((await readFile(path.join(root, 'public/uploads/image.png'))).toString()).toBe('abcdef')
  expect(await storage.complete(task, parts)).toBe('/uploads/image.png')
})

test('a corrupted persisted part cannot be published as a complete image', async () => {
  const storage = new LocalImageStorage(root)
  const task = { id: 'corrupt-task', objectKey: 'image.png', remoteUploadId: null, fileSize: 3, fileType: 'image/png', fileHash: 'fingerprint' }
  await storage.putPart(task, 1, Buffer.from('bad'))
  await expect(storage.complete(task, [{ partNumber: 1, size: 3, hash: hash(Buffer.from('abc')), etag: 'etag' }])).rejects.toMatchObject({ partNumber: 1 })
  await expect(stat(path.join(root, 'public/uploads/image.png'))).rejects.toMatchObject({ code: 'ENOENT' })
})

test('discarding an incomplete task removes an artifact published before database confirmation failed', async () => {
  const storage = new LocalImageStorage(root)
  const task = { id: 'orphan-task', objectKey: 'orphan.png', remoteUploadId: null, fileSize: 3, fileType: 'image/png', fileHash: 'fingerprint' }
  await storage.putPart(task, 1, Buffer.from('abc'))
  await storage.complete(task, [{ partNumber: 1, size: 3, hash: hash(Buffer.from('abc')), etag: 'etag' }])
  await storage.discard(task)
  await expect(stat(path.join(root, 'public/uploads/orphan.png'))).rejects.toMatchObject({ code: 'ENOENT' })
})

test('OSS completion recovers its lost response and expired tasks delete their final orphan object', async () => {
  let published = false
  let completeCalls = 0
  const client = {
    initMultipartUpload: async (_key: string, options: { headers: Record<string, string> }) => {
      expect(options.headers['x-oss-meta-fingerprint']).toBe('fingerprint')
      return { uploadId: 'oss-upload' }
    },
    uploadPart: async (_key: string, _id: string, _number: number, bytes: Buffer, start: number, end: number) => {
      expect(bytes.subarray(start, end).toString()).toBe('abc')
      return { etag: 'oss-etag' }
    },
    head: async () => {
      if (!published) throw Object.assign(new Error('missing'), { code: 'NoSuchKey' })
      return { res: { headers: { 'content-length': '3', 'x-oss-meta-fingerprint': 'fingerprint' } } }
    },
    completeMultipartUpload: async (_key: string, _id: string, parts: unknown) => {
      expect(parts).toEqual([{ number: 1, etag: 'oss-etag' }])
      completeCalls++; published = true
      throw new Error('response lost')
    },
    generateObjectUrl: () => 'https://images.example.com/image.png',
    abortMultipartUpload: async () => { throw Object.assign(new Error('already complete'), { code: 'NoSuchUpload' }) },
    delete: async () => { published = false },
  }
  const storage = new OssImageStorage(client as unknown as OSS)
  const task = { id: 'oss-task', objectKey: 'image.png', remoteUploadId: await storage.init('image.png', 'image/png', 'fingerprint'), fileSize: 3, fileType: 'image/png', fileHash: 'fingerprint' }
  const etag = await storage.putPart(task, 1, Buffer.from('abc'))
  const parts = [{ partNumber: 1, size: 3, hash: hash(Buffer.from('abc')), etag }]
  await expect(storage.complete(task, parts)).rejects.toThrow('response lost')
  expect(await storage.complete(task, parts)).toBe('https://images.example.com/image.png')
  expect(completeCalls).toBe(1)
  await storage.discard(task)
  expect(published).toBe(false)
})

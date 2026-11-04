import { File as NodeFile } from 'buffer'
import { webcrypto, createHash } from 'crypto'
import { uploadImage } from '@/lib/upload-image'
import { hashImage } from '@/lib/image-upload/hash-image'
import { runUploadQueue, retryUpload, UploadRequestError } from '@/lib/image-upload/transport'

const originalFetch = global.fetch
const originalCrypto = global.crypto
const image = (size: number) => new NodeFile([Buffer.alloc(size)], 'photo.png', { type: 'image/png' }) as unknown as File
const ok = (data: unknown) => new Response(JSON.stringify({ code: 2000, data }), { headers: { 'Content-Type': 'application/json' } })
const task = { uploadId: 'task-id', partSize: 5242880, totalParts: 2, uploadedParts: [] as number[], status: 'UPLOADING', url: null }
beforeEach(() => { global.fetch = jest.fn(); Object.defineProperty(global, 'crypto', { value: webcrypto, configurable: true }) })
afterEach(() => { global.fetch = originalFetch; Object.defineProperty(global, 'crypto', { value: originalCrypto, configurable: true }); jest.useRealTimers() })

test('images below 10 MiB keep using a single direct request', async () => {
  ;(fetch as jest.Mock).mockResolvedValue(ok({ url: '/small.png' }))
  expect(await uploadImage(image(10 * 1024 * 1024 - 1))).toBe('/small.png')
  expect((fetch as jest.Mock).mock.calls.map(call => call[0])).toEqual(['/api/upload'])
})

test('bounded hashing produces a deterministic fingerprint from every part, including the short last part', async () => {
  const file = image(10 * 1024 * 1024 + 1)
  const manifest = await hashImage(file)
  const full = Buffer.alloc(file.size)
  const hashes = [full.subarray(0, 5242880), full.subarray(5242880, 10485760), full.subarray(10485760)].map(bytes => createHash('sha256').update(bytes).digest('hex'))
  expect(manifest.hashes).toEqual(hashes)
  expect(manifest.fileHash).toBe(createHash('sha256').update(JSON.stringify([file.size, 5242880, hashes])).digest('hex'))
})

test('exactly 10 MiB resumes from server-confirmed parts and only sends the missing part', async () => {
  const urls: string[] = []
  ;(fetch as jest.Mock).mockImplementation(async (url: string) => {
    urls.push(url)
    if (url.endsWith('/complete')) return ok({ url: '/large.png' })
    if (url.endsWith('/parts/2')) return ok({ partNumber: 2 })
    return ok({ ...task, uploadedParts: [1] })
  })
  expect(await uploadImage(image(10 * 1024 * 1024))).toBe('/large.png')
  expect(urls).toEqual(['/api/upload/multipart', '/api/upload/multipart/task-id', '/api/upload/multipart/task-id/parts/2', '/api/upload/multipart/task-id/complete'])
})

test('instant upload returns a completed result without sending file bytes', async () => {
  ;(fetch as jest.Mock).mockResolvedValue(ok({ ...task, status: 'COMPLETED', url: '/existing.png' }))
  expect(await uploadImage(image(10 * 1024 * 1024))).toBe('/existing.png')
  expect((fetch as jest.Mock).mock.calls).toHaveLength(1)
})

test('queue never exceeds its concurrency limit and processes each item once', async () => {
  let active = 0, maximum = 0
  const completed: number[] = []
  await runUploadQueue([1, 2, 3, 4, 5, 6, 7], async number => {
    active++; maximum = Math.max(maximum, active)
    await new Promise(resolve => setTimeout(resolve, 1))
    completed.push(number); active--
  }, undefined, 3)
  expect(maximum).toBe(3)
  expect(completed.sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
})

test('queue aborts sibling work and starts no new parts after one fails', async () => {
  const started: number[] = []
  await expect(runUploadQueue([1, 2, 3, 4, 5], async (number, signal) => {
    started.push(number)
    if (number === 1) throw new Error('failed')
    await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }))
  }, undefined, 3)).rejects.toThrow('failed')
  expect(started).toEqual([1, 2, 3])
})

test('transient errors retry up to three times, permanent errors and cancellation do not retry', async () => {
  jest.useFakeTimers()
  let attempts = 0
  const retried = retryUpload(async () => { if (++attempts < 4) throw new UploadRequestError('temporary', 503); return 'done' })
  const checked = expect(retried).resolves.toBe('done')
  await jest.runAllTimersAsync(); await checked
  expect(attempts).toBe(4)
  attempts = 0
  await expect(retryUpload(async () => { attempts++; throw new UploadRequestError('forbidden', 403) })).rejects.toThrow('forbidden')
  expect(attempts).toBe(1)
  const controller = new AbortController(); controller.abort()
  await expect(retryUpload(async () => { attempts++; return 'unreachable' }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(attempts).toBe(1)
})

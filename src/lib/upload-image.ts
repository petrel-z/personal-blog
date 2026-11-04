import { IMAGE_PART_SIZE, imageUploadError, isMultipartImage, partRange, type UploadProgress, type UploadTaskResult } from '@/shared/image-upload'
import { hashImage } from './image-upload/hash-image'
import { requestUpload, retryUpload, runUploadQueue } from './image-upload/transport'

/** Both cover images and editor images automatically choose the same protocol. */
export async function uploadImage(file: File, signal?: AbortSignal, progress?: (value: UploadProgress) => void): Promise<string> {
  signal?.throwIfAborted()
  const validation = imageUploadError(file)
  if (validation) throw new Error(validation)
  if (!isMultipartImage(file.size)) {
    const form = new FormData()
    form.append('file', file)
    progress?.({ phase: 'uploading', percent: 0 })
    const result = await requestUpload<{ url: string }>('/api/upload', { method: 'POST', body: form }, signal)
    if (typeof result.url !== 'string' || !result.url) throw new Error('图片上传结果无效')
    progress?.({ phase: 'uploading', percent: 100 })
    return result.url
  }
  const manifest = await hashImage(file, signal, progress)
  let task = await retryUpload(() => requestUpload<UploadTaskResult>('/api/upload/multipart', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(manifest),
  }, signal), signal)
  if (task.status === 'COMPLETED' && task.url) return task.url
  task = await retryUpload(() => requestUpload<UploadTaskResult>(`/api/upload/multipart/${task.uploadId}`, { method: 'GET' }, signal), signal)
  if (task.status === 'COMPLETED' && task.url) return task.url
  if (task.partSize !== IMAGE_PART_SIZE || task.totalParts !== manifest.hashes.length) throw new Error('服务端分片规则不匹配')
  const confirmed = new Set(task.uploadedParts)
  let confirmedBytes = 0
  for (const number of Array.from(confirmed)) confirmedBytes += partRange(file.size, number).size
  const report = () => progress?.({ phase: 'uploading', percent: Math.floor(confirmedBytes / file.size * 100) })
  report()
  const missing = Array.from({ length: task.totalParts }, (_, index) => index + 1).filter(number => !confirmed.has(number))
  await runUploadQueue(missing, async (number, partSignal) => {
    const { start, end, size } = partRange(file.size, number)
    await retryUpload(() => requestUpload(`/api/upload/multipart/${task.uploadId}/parts/${number}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: file.slice(start, end),
    }, partSignal), partSignal)
    partSignal.throwIfAborted()
    confirmedBytes += size
    report()
  }, signal)
  signal?.throwIfAborted()
  progress?.({ phase: 'completing', percent: 100 })
  const result = await retryUpload(() => requestUpload<{ url: string }>(`/api/upload/multipart/${task.uploadId}/complete`, { method: 'POST' }, signal), signal)
  if (typeof result.url !== 'string' || !result.url) throw new Error('图片上传结果无效')
  return result.url
}

/** One protocol for cover images and pasted/dropped/selected article images. */
export const DIRECT_IMAGE_LIMIT = 10 * 1024 * 1024
export const MAX_IMAGE_SIZE = 200 * 1024 * 1024
export const IMAGE_PART_SIZE = 5 * 1024 * 1024
export const IMAGE_UPLOAD_CONCURRENCY = 3
export const IMAGE_UPLOAD_RETRIES = 3
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const

export type UploadProgress = { phase: 'hashing' | 'uploading' | 'completing'; percent: number }
export type UploadManifest = { size: number; type: string; fileHash: string; hashes: string[] }
export type UploadTaskResult = {
  uploadId: string
  partSize: number
  totalParts: number
  uploadedParts: number[]
  status: string
  url: string | null
}

export function imageUploadError(file: { type: string; size: number }): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return '仅支持 JPG、PNG、GIF、WebP 图片。'
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return '图片文件不能为空。'
  if (file.size > MAX_IMAGE_SIZE) return '图片大小不能超过 200 MiB。'
  return null
}

export const isMultipartImage = (size: number) => size >= DIRECT_IMAGE_LIMIT
export const manifestPayload = (size: number, hashes: readonly string[]) => JSON.stringify([size, IMAGE_PART_SIZE, hashes])

export function partRange(fileSize: number, partNumber: number) {
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > Math.ceil(fileSize / IMAGE_PART_SIZE)) {
    throw new Error('无效的分片编号')
  }
  const start = (partNumber - 1) * IMAGE_PART_SIZE
  const end = Math.min(start + IMAGE_PART_SIZE, fileSize)
  return { start, end, size: end - start }
}

export function uploadProgressLabel(progress: UploadProgress) {
  if (progress.phase === 'hashing') return `正在校验图片 ${progress.percent}%…`
  if (progress.phase === 'completing') return '图片处理中…'
  return `图片上传中 ${progress.percent}%…`
}

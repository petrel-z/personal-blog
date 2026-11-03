import { IMAGE_PART_SIZE, manifestPayload, partRange, type UploadManifest, type UploadProgress } from '@/shared/image-upload'

async function digest(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
}

/** Read at most one 5 MiB part at a time; WebCrypto work is asynchronous. */
export async function hashImage(file: File, signal?: AbortSignal, progress?: (value: UploadProgress) => void): Promise<UploadManifest> {
  if (!globalThis.crypto?.subtle) throw new Error('大图片上传需要在 HTTPS 或 localhost 中打开页面。')
  const hashes: string[] = []
  const total = Math.ceil(file.size / IMAGE_PART_SIZE)
  progress?.({ phase: 'hashing', percent: 0 })
  for (let number = 1; number <= total; number++) {
    signal?.throwIfAborted()
    const { start, end } = partRange(file.size, number)
    hashes.push(await digest(await file.slice(start, end).arrayBuffer()))
    signal?.throwIfAborted()
    progress?.({ phase: 'hashing', percent: Math.floor(end / file.size * 100) })
  }
  const encoded = new TextEncoder().encode(manifestPayload(file.size, hashes))
  const fileHash = await digest(encoded.buffer as ArrayBuffer)
  signal?.throwIfAborted()
  return { size: file.size, type: file.type, hashes, fileHash }
}

import { createHash } from 'crypto'
import { DIRECT_IMAGE_LIMIT, IMAGE_PART_SIZE, imageUploadError, manifestPayload, type UploadManifest } from '@/shared/image-upload'

export class UploadError extends Error {
  constructor(message: string, public readonly status = 400, public readonly retryable = false) { super(message); this.name = 'UploadError' }
}

export class InvalidStoredPartError extends UploadError {
  constructor(public readonly partNumber: number) { super('分片已损坏或丢失，请重新选择同一图片补传', 409) }
}

export const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')

export function validateUploadManifest(value: unknown): UploadManifest & { totalParts: number } {
  if (!value || typeof value !== 'object') throw new UploadError('无效的上传参数')
  const { size, type, fileHash, hashes } = value as UploadManifest
  if (typeof size !== 'number' || typeof type !== 'string') throw new UploadError('无效的图片信息')
  const error = imageUploadError({ size, type })
  if (error) throw new UploadError(error)
  if (size < DIRECT_IMAGE_LIMIT) throw new UploadError('小于 10 MiB 的图片请直接上传')
  const totalParts = Math.ceil(size / IMAGE_PART_SIZE)
  if (!Array.isArray(hashes) || hashes.length !== totalParts || hashes.some(hash => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) {
    throw new UploadError('分片校验清单无效')
  }
  if (typeof fileHash !== 'string' || sha256(manifestPayload(size, hashes)) !== fileHash) throw new UploadError('文件指纹不匹配')
  return { size, type, fileHash, hashes, totalParts }
}

export function verifyImageSignature(bytes: Buffer, type: string) {
  const matches = type === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    : type === 'image/jpeg' ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : type === 'image/gif' ? ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))
    : type === 'image/webp' ? bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
    : false
  if (!matches) throw new UploadError('图片内容与文件类型不匹配')
}

/** Limit actual streamed bytes too; Content-Length alone is not trustworthy. */
export async function readUploadBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit) throw new UploadError('上传内容超过大小限制', 413)
  const reader = request.body?.getReader()
  if (!reader) throw new UploadError('没有上传内容')
  const buffers: Buffer[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) { await reader.cancel(); throw new UploadError('上传内容超过大小限制', 413) }
      buffers.push(Buffer.from(value))
    }
  } finally { reader.releaseLock() }
  return Buffer.concat(buffers, size)
}

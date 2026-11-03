import { createHash } from 'crypto'
import { imageUploadError, isMultipartImage, partRange, IMAGE_PART_SIZE } from '@/shared/image-upload'
import { validateUploadManifest, verifyImageSignature } from '@/server/features/upload/upload-validation'

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

test('routes exactly 10 MiB to multipart, while smaller images remain direct uploads', () => {
  expect(isMultipartImage(10 * 1024 * 1024 - 1)).toBe(false)
  expect(isMultipartImage(10 * 1024 * 1024)).toBe(true)
  expect(isMultipartImage(10 * 1024 * 1024 + 1)).toBe(true)
  expect(imageUploadError({ size: 6 * 1024 * 1024, type: 'image/png' })).toBeNull()
  expect(imageUploadError({ size: 0, type: 'image/png' })).not.toBeNull()
  expect(imageUploadError({ size: 200 * 1024 * 1024 + 1, type: 'image/png' })).toContain('200')
  expect(imageUploadError({ size: 100, type: 'image/svg+xml' })).not.toBeNull()
})

test('part ranges use one-based numbering, cover the short final part and reject invalid indexes', () => {
  expect(partRange(12 * 1024 * 1024, 1)).toEqual({ start: 0, end: 5242880, size: 5242880 })
  expect(partRange(12 * 1024 * 1024, 3)).toEqual({ start: 10485760, end: 12582912, size: 2097152 })
  for (const number of [0, -1, 1.5, 4, NaN]) expect(() => partRange(12 * 1024 * 1024, number)).toThrow()
})

test('server derives total parts and verifies the fingerprint against the complete manifest', () => {
  const size = 10 * 1024 * 1024 + 1
  const hashes = [digest('first'), digest('second'), digest('last')]
  const fileHash = digest(JSON.stringify([size, IMAGE_PART_SIZE, hashes]))
  expect(validateUploadManifest({ size, type: 'image/png', hashes, fileHash })).toMatchObject({ totalParts: 3, hashes, fileHash })
  for (const invalid of [
    { size: size - 2 }, { hashes: hashes.slice(0, 2) }, { hashes: [...hashes, digest('extra')] },
    { hashes: [hashes[0], '../path', hashes[2]] }, { fileHash: '0'.repeat(64) },
    { size: 200 * 1024 * 1024 + 1 }, { type: 'text/html' },
  ]) expect(() => validateUploadManifest({ size, type: 'image/png', hashes, fileHash, ...invalid })).toThrow()
})

test('image signatures must match the allowed MIME type', () => {
  verifyImageSignature(Buffer.from('89504e470d0a1a0a', 'hex'), 'image/png')
  verifyImageSignature(Buffer.from('ffd8ff', 'hex'), 'image/jpeg')
  verifyImageSignature(Buffer.from('GIF89a'), 'image/gif')
  verifyImageSignature(Buffer.from('524946460000000057454250', 'hex'), 'image/webp')
  expect(() => verifyImageSignature(Buffer.from('<script>'), 'image/png')).toThrow()
  expect(() => verifyImageSignature(Buffer.from('GIF89a'), 'image/png')).toThrow()
})

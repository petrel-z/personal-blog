import { randomUUID } from 'crypto'
import { withPermission } from '@/server/auth/route'
import { DIRECT_IMAGE_LIMIT, imageUploadError } from '@/shared/image-upload'
import { getImageStorage, imageExtension } from '@/server/features/upload/upload-storage'
import { readUploadBody, UploadError, verifyImageSignature } from '@/server/features/upload/upload-validation'
import { uploadResponse } from '@/server/features/upload/upload-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const POST = withPermission('upload:create', async request => uploadResponse(async () => {
  const contentType = request.headers.get('content-type') || ''
  if (!contentType.startsWith('multipart/form-data')) throw new UploadError('请使用文件表单上传')
  const bytes = await readUploadBody(request, DIRECT_IMAGE_LIMIT + 64 * 1024)
  let form: FormData
  try { form = await new Request(request.url, { method: 'POST', headers: { 'content-type': contentType }, body: bytes }).formData() }
  catch { throw new UploadError('上传表单格式错误') }
  const file = form.get('file')
  if (!file || typeof file === 'string') throw new UploadError('没有上传文件')
  const error = imageUploadError(file)
  if (error) throw new UploadError(error)
  if (file.size >= DIRECT_IMAGE_LIMIT) throw new UploadError('达到 10 MiB 的图片请使用分片上传', 413)
  const buffer = Buffer.from(await file.arrayBuffer())
  verifyImageSignature(buffer, file.type)
  const key = `${randomUUID()}.${imageExtension(file.type)}`
  return { url: await getImageStorage().putImage(key, buffer, file.type) }
}))

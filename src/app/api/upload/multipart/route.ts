import { withPermission } from '@/server/auth/route'
import { createImageUpload } from '@/server/features/upload/upload.service'
import { uploadResponse } from '@/server/features/upload/upload-response'
import { readUploadBody, UploadError } from '@/server/features/upload/upload-validation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const POST = withPermission('upload:create', async (request, _context, actor) => uploadResponse(async () => {
  const bytes = await readUploadBody(request, 16 * 1024)
  let input: unknown
  try { input = JSON.parse(bytes.toString('utf8')) } catch { throw new UploadError('上传参数格式错误') }
  return createImageUpload(actor.id, input)
}))

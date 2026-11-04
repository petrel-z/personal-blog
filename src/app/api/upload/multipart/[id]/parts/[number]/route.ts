import { withPermission } from '@/server/auth/route'
import { uploadImagePart } from '@/server/features/upload/upload.service'
import { uploadResponse } from '@/server/features/upload/upload-response'
import { readUploadBody, UploadError } from '@/server/features/upload/upload-validation'
import { IMAGE_PART_SIZE } from '@/shared/image-upload'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const PUT = withPermission<{ params: { id: string; number: string } }>('upload:create', async (request, { params }, actor) =>
  uploadResponse(async () => {
    if (!/^[1-9]\d*$/.test(params.number)) throw new UploadError('无效的分片编号')
    return uploadImagePart(actor.id, params.id, Number(params.number), await readUploadBody(request, IMAGE_PART_SIZE))
  }))

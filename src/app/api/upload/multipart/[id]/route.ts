import { withPermission } from '@/server/auth/route'
import { getImageUpload } from '@/server/features/upload/upload.service'
import { uploadResponse } from '@/server/features/upload/upload-response'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const GET = withPermission<{ params: { id: string } }>('upload:create', async (_request, { params }, actor) =>
  uploadResponse(() => getImageUpload(actor.id, params.id)))

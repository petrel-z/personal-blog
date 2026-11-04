import { NextResponse } from 'next/server'
import { success } from '@/lib/api-response'
import { UploadError } from './upload-validation'

export async function uploadResponse(operation: () => Promise<unknown>) {
  try { return NextResponse.json(success(await operation(), '上传成功')) }
  catch (error) {
    if (error instanceof UploadError) return NextResponse.json({ code: error.status * 10, message: error.message,
      data: null, retryable: error.retryable, timestamp: Date.now() }, { status: error.status,
      ...(error.retryable ? { headers: { 'Retry-After': '1' } } : {}) })
    console.error('Image upload operation failed')
    return NextResponse.json({ code: 5000, message: '图片上传暂时失败，请重试；已完成分片会保留。', data: null, timestamp: Date.now() }, { status: 500 })
  }
}

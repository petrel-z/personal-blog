/**
 * Upload API Routes
 * 处理文件上传，支持本地存储和阿里云 OSS
 */

import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import OSS from 'ali-oss'
import { storageConfig, isOssEnabled } from '@/shared/config/storage'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// POST /api/upload
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { code: 4000, message: '没有上传文件', data: null, timestamp: Date.now() },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { code: 4000, message: '不支持的文件类型，仅支持 JPG、PNG、GIF、WebP', data: null, timestamp: Date.now() },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { code: 4000, message: '文件大小超过限制，最大 5MB', data: null, timestamp: Date.now() },
        { status: 400 }
      )
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg'
    const filename = `${randomUUID()}.${ext}`

    // Read file buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let url: string

    if (isOssEnabled()) {
      // Upload to Aliyun OSS
      const client = new OSS({
        accessKeyId: storageConfig.oss.accessKeyId,
        accessKeySecret: storageConfig.oss.accessKeySecret,
        bucket: storageConfig.oss.bucket,
        region: storageConfig.oss.region,
        // 默认使用 HTTPS
        secure: true,
      })

      try {
        // 先测试 listBuckets 确认配置是否正确
        console.log('Testing OSS connection with bucket:', storageConfig.oss.bucket, 'region:', storageConfig.oss.region)

        // 上传文件到 OSS
        const result = await client.put(filename, buffer)
        console.log('OSS upload result:', result)
        url = result.url

        // 如果配置了 CDN 域名，使用 CDN URL
        if (storageConfig.oss.cdnDomain) {
          url = `${storageConfig.oss.cdnDomain.replace(/\/$/, '')}/${filename}`
        } else if (url && !url.startsWith('http')) {
          // OSS 返回的是相对路径，拼上默认域名
          url = `https://${storageConfig.oss.bucket}.${storageConfig.oss.endpoint}/${filename}`
        }
      } catch (ossError: any) {
        console.error('OSS upload failed:', ossError)
        console.error('OSS error code:', ossError.code)
        console.error('OSS error message:', ossError.message)
        console.error('OSS request ID:', ossError.requestId)
        console.error('OSS status:', ossError.status)
        console.error('OSS params:', ossError.params)
        return NextResponse.json(
          { code: 5000, message: `上传到云存储失败: ${ossError.message || '未知错误'}`, data: null, timestamp: Date.now() },
          { status: 500 }
        )
      }
    } else {
      // Local storage fallback
      const uploadDir = path.join(process.cwd(), 'public', 'uploads')
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
      }

      const filepath = path.join(uploadDir, filename)
      await writeFile(filepath, buffer)

      url = `/uploads/${filename}`
    }

    return NextResponse.json({
      code: 2000,
      message: '上传成功',
      data: { url },
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('Upload failed:', error)
    return NextResponse.json(
      { code: 5000, message: '上传失败', data: null, timestamp: Date.now() },
      { status: 500 }
    )
  }
}

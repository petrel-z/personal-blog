/**
 * 图片上传工具函数
 * 封装 /api/upload 接口，返回图片 URL
 */

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })

  const result = await response.json()

  if (result.code !== 2000) {
    throw new Error(result.message || '图片上传失败')
  }

  return result.data.url
}

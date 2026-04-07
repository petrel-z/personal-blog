/**
 * Storage Configuration
 * 支持本地存储和阿里云 OSS 两种模式
 */

export const storageConfig = {
  // 存储提供者: 'local' | 'oss'
  provider: process.env.STORAGE_PROVIDER || 'local',

  // 本地存储配置
  local: {
    uploadDir: 'public/uploads',
  },

  // 阿里云 OSS 配置
  oss: {
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || '',
    region: process.env.OSS_REGION || '',
    endpoint: process.env.OSS_ENDPOINT || '',
    // CDN 域名（可选），如果配置了则使用 CDN URL
    cdnDomain: process.env.OSS_CDN_DOMAIN || '',
  },
}

// 判断是否使用 OSS
export const isOssEnabled = () => storageConfig.provider === 'oss'

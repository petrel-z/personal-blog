/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep preview/test builds separate from an already running development server.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: '*.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'petrel-blog.oss-cn-beijing.aliyuncs.com',
      },
      {
        protocol: 'https',
        hostname: '*.oss-cn-beijing.aliyuncs.com',
      },
      {
        protocol: 'https',
        hostname: '*.aliyuncs.com',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig

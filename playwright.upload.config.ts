import { defineConfig } from '@playwright/test'
import authConfig from './playwright.auth.config'

export default defineConfig({
  ...authConfig,
  testMatch: ['integration/editor-images.spec.ts', 'integration/large-image-upload.spec.ts'],
  webServer: {
    ...authConfig.webServer as Exclude<typeof authConfig.webServer, unknown[]>,
    command: 'pnpm dev --hostname 127.0.0.1 --port 3017',
    url: 'http://127.0.0.1:3017/login',
    env: { ...(authConfig.webServer as { env?: Record<string, string> }).env,
      STORAGE_PROVIDER: 'local', NEXT_DIST_DIR: '.next-ui-uploads' },
  },
})

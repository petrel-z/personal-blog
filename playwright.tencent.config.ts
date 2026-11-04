import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  outputDir: 'test-results/tencent',
  testDir: './tests/e2e', testMatch: 'tencent-password-recovery.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:3020', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium' } }],
  webServer: {
    command: 'pnpm dev --hostname 127.0.0.1 --port 3020',
    url: 'http://127.0.0.1:3020/login', reuseExistingServer: false, timeout: 120_000,
    env: { NEXT_DIST_DIR: '.next-ui-tencent', NEXT_PUBLIC_CAPTCHA_APP_ID: '123456' },
  },
})

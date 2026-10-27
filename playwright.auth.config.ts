import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

// Workers reload this config after DATABASE_URL has been set to the test database.
const applicationUrl = parseEnv(readFileSync('.env', 'utf8')).DATABASE_URL
const testEnv = parseEnv(readFileSync('.env.auth-test', 'utf8'))
const testUrl = testEnv.AUTH_TEST_DATABASE_URL
if (!testUrl || !new URL(testUrl).pathname.endsWith('_auth_test')) {
  throw new Error('AUTH_TEST_DATABASE_URL must name an isolated *_auth_test database')
}
if (!applicationUrl || !testEnv.AUTH_SECRET) {
  throw new Error('Set DATABASE_URL in .env and a test-only AUTH_SECRET in .env.auth-test')
}
const application = new URL(applicationUrl)
const isolated = new URL(testUrl)
if (application.pathname === isolated.pathname) {
  throw new Error('Auth tests must use a database name different from the application database')
}
process.env.AUTH_TEST_DATABASE_URL = testUrl
process.env.DATABASE_URL = testUrl
process.env.AUTH_SECRET = testEnv.AUTH_SECRET
process.env.AUTH_URL = 'http://127.0.0.1:3017'
process.env.AUTH_CODE_SECRET = testEnv.AUTH_CODE_SECRET || 'isolated-password-reset-secret-32-bytes-minimum'

export default defineConfig({
  testDir: './tests',
  testMatch: ['e2e/auth-captcha.spec.ts', 'integration/**/*.spec.ts'],
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:3017', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium' } }],
  webServer: {
    command: 'pnpm dev --hostname 127.0.0.1 --port 3017',
    url: 'http://127.0.0.1:3017/login',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: testUrl, AUTH_URL: 'http://127.0.0.1:3017', AUTH_SECRET: process.env.AUTH_SECRET!,
      AUTH_CODE_SECRET: process.env.AUTH_CODE_SECRET!,
      // These tests inject capture transports; never inherit a real SMTP destination.
      SMTP_HOST: '', SMTP_PORT: '', SMTP_SECURE: '', SMTP_USER: '', SMTP_PASSWORD: '', MAIL_FROM: '',
    },
  },
})

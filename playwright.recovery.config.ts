import { defineConfig } from '@playwright/test'
import authConfig from './playwright.auth.config'
import { resolve } from 'node:path'

// Worker processes use the same loopback SMTP certificate as the app fixture.
process.env.NODE_EXTRA_CA_CERTS = resolve('tests/fixtures/smtp/localhost-cert.pem')

// The recovery fixture owns its loopback SMTP server and dedicated application.
// Keep the existing auth suite's missing-SMTP coverage independent.
export default defineConfig({
  ...authConfig,
  outputDir: 'test-results/recovery',
  testMatch: ['e2e/password-recovery.spec.ts'],
  webServer: undefined,
  use: { ...authConfig.use, baseURL: 'http://127.0.0.1:3018', trace: 'off' },
})

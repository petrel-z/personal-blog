import { defineConfig } from '@playwright/test'
import authConfig from './playwright.auth.config'

// The recovery fixture owns its loopback SMTP server and dedicated application.
// Keep the existing auth suite's missing-SMTP coverage independent.
export default defineConfig({
  ...authConfig,
  testMatch: ['e2e/password-recovery.spec.ts'],
  webServer: undefined,
  use: { ...authConfig.use, baseURL: 'http://127.0.0.1:3018', trace: 'off' },
})

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 1,
  use: {
    headless: true,
    viewport: { width: 1100, height: 750 },
  },
})

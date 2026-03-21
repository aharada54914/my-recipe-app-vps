import { defineConfig, devices } from '@playwright/test'

const deployedBaseUrl = process.env.PLAYWRIGHT_BASE_URL
const localBaseUrl = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],
  timeout: 45_000,
  expect: {
    timeout: 12_000,
  },
  use: {
    baseURL: deployedBaseUrl ?? localBaseUrl,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium',
        ...devices['Pixel 7'],
      },
    },
  ],
  webServer: deployedBaseUrl
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173',
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})

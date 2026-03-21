import { defineConfig, devices } from '@playwright/test'

const localBaseUrl = 'http://127.0.0.1:4173'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  timeout: 45_000,
  expect: {
    timeout: 12_000,
  },
  use: {
    baseURL: localBaseUrl,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-webkit',
      use: {
        browserName: 'webkit',
        ...devices['iPhone 13'],
      },
    },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: localBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})

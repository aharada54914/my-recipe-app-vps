import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const statePath = process.env.DISCORD_E2E_STORAGE_STATE
  ?? path.resolve(process.cwd(), 'tests/e2e/.auth/discord-user.json')
const e2eEnabled = process.env.DISCORD_E2E_ENABLED === '1'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 20_000,
  },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],
  use: {
    baseURL: 'https://discord.com',
    headless: process.env.DISCORD_E2E_HEADED !== '1',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...(e2eEnabled ? { storageState: statePath } : {}),
    viewport: { width: 1440, height: 1000 },
  },
  projects: [
    {
      name: 'discord-chromium',
      use: {
        browserName: 'chromium',
        ...devices['Desktop Chrome'],
      },
    },
  ],
})

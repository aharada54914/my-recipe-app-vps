import { expect, test } from '@playwright/test'
import { seedLegacyGeminiKey, waitForRouteReady } from '../support/app'

test('gemini connected state is visible after seeding a local key', async ({ page }) => {
  await seedLegacyGeminiKey(page)
  await waitForRouteReady(page, '/gemini', page.getByTestId('gemini-hero'))

  await expect(page.getByText('Gemini キーが旧形式で保存されています')).toBeVisible()

  await waitForRouteReady(page, '/settings/menu', page.getByText('Gemini API（AI連携機能）の設定'))
  await expect(page.getByText('Gemini キーが旧形式で保存されています')).toBeVisible()
})

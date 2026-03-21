import { expect, test } from '@playwright/test'
import { waitForRouteReady } from '../support/app'

test('gemini entry page exposes hero actions and tab switching', async ({ page }) => {
  await waitForRouteReady(page, '/gemini', page.getByTestId('gemini-hero'))

  await expect(page.getByTestId('gemini-hero-tab-import')).toBeVisible()
  await expect(page.getByTestId('gemini-hero-tab-suggest')).toBeVisible()
  await expect(page.getByTestId('gemini-hero-tab-chat')).toBeVisible()

  await page.getByTestId('gemini-tab-chat').click()
  await expect(page.getByTestId('gemini-tab-chat')).toHaveAttribute('aria-pressed', 'true')
})

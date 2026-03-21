import { expect, test } from '@playwright/test'
import { applyDeterministicRandom, applyTestClock, applyTheme, seedLegacyGeminiKey, waitForRouteReady } from '../support/app'

test('gemini page matches the connected baseline', async ({ page }) => {
  await applyTestClock(page)
  await applyDeterministicRandom(page)
  await applyTheme(page, 'light')
  await seedLegacyGeminiKey(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await waitForRouteReady(page, '/gemini', page.getByTestId('gemini-hero'))

  await expect(page).toHaveScreenshot('gemini-connected-light.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

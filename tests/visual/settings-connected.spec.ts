import { expect, test } from '@playwright/test'
import { applyDeterministicRandom, applyTestClock, applyTheme, waitForRouteReady } from '../support/app'

test('connected settings matches the QA Google dark baseline', async ({ page }) => {
  await applyTestClock(page)
  await applyDeterministicRandom(page)
  await applyTheme(page, 'dark')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await waitForRouteReady(page, '/settings/account?qa-google=1', page.getByText('Google ログインとバックアップ'))

  await expect(page).toHaveScreenshot('settings-account-qa-dark.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

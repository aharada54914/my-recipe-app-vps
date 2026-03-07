import { expect, test } from '@playwright/test'
import { applyDeterministicRandom, applyTestClock, applyTheme, waitForRouteReady } from '../support/app'

test('home page matches the light mobile baseline', async ({ page }) => {
  await applyTestClock(page)
  await applyDeterministicRandom(page)
  await applyTheme(page, 'light')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await waitForRouteReady(page, '/', page.getByTestId('home-primary-search'))
  await page.evaluate(() => window.scrollTo(0, 0))

  await expect(page).toHaveScreenshot('home-light.png', {
    animations: 'disabled',
  })
})

test('home page matches the dark mobile baseline', async ({ page }) => {
  await applyTestClock(page)
  await applyDeterministicRandom(page)
  await applyTheme(page, 'dark')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await waitForRouteReady(page, '/', page.getByTestId('home-primary-search'))
  await page.evaluate(() => window.scrollTo(0, 0))

  await expect(page).toHaveScreenshot('home-dark.png', {
    animations: 'disabled',
  })
})

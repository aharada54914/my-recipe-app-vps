import { expect, test } from '@playwright/test'
import { applyDeterministicRandom, applyTestClock, applyTheme, waitForRouteReady } from '../support/app'

test('search page matches the dark baseline with a live query', async ({ page }) => {
  await applyTestClock(page)
  await applyDeterministicRandom(page)
  await applyTheme(page, 'dark')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await waitForRouteReady(page, '/search', page.getByPlaceholder('レシピを検索...'))

  await page.getByPlaceholder('レシピを検索...').fill('ぴー')

  await expect(page).toHaveScreenshot('search-dark-query.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

import { expect, test } from '@playwright/test'
import { applyDeterministicRandom, applyTestClock, applyTheme, ensureWeeklyMenuGenerated } from '../support/app'

test('weekly menu matches the dark generated baseline', async ({ page }) => {
  await applyTestClock(page)
  await applyDeterministicRandom(page)
  await applyTheme(page, 'dark')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await ensureWeeklyMenuGenerated(page)
  await expect(page.getByText('週間献立を作成しました')).toHaveCount(0)

  await expect(page).toHaveScreenshot('weekly-menu-dark.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

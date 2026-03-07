import { expect, test } from '@playwright/test'
import { ensureWeeklyMenuGenerated } from '../support/app'

test('weekly menu swap replaces the featured main dish and persists after reload', async ({ page }) => {
  await ensureWeeklyMenuGenerated(page)

  const featuredCard = page.getByTestId('weekly-featured-day').locator('[data-testid="weekly-day-card"]').first()
  const originalTitle = await featuredCard.getByTestId('weekly-day-title').innerText()

  await featuredCard.getByTestId('weekly-swap-main').click()
  const modal = page.getByTestId('swap-modal')
  await expect(modal).toBeVisible()

  const candidates = modal.getByTestId('swap-candidate')
  const candidateCount = await candidates.count()
  let selectedTitle: string | null = null
  for (let i = 0; i < candidateCount; i += 1) {
    const candidate = candidates.nth(i)
    const title = await candidate.getAttribute('data-recipe-title')
    if (title && title !== originalTitle) {
      selectedTitle = title
      await candidate.locator('button').click()
      break
    }
  }

  expect(selectedTitle).not.toBeNull()
  await expect(modal).not.toBeVisible()
  await expect(featuredCard.getByTestId('weekly-day-title')).toHaveText(selectedTitle!)

  await page.reload()
  await expect(page.getByTestId('weekly-featured-day').locator('[data-testid="weekly-day-title"]').first()).toHaveText(selectedTitle!)
})

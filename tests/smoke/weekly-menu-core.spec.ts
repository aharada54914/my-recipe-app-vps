import { expect, test } from '@playwright/test'
import { ensureWeeklyMenuGenerated, expandWeeklyWeather, waitForRouteReady } from '../support/app'

test('weekly menu generation creates and persists summary and 7 day cards', async ({ page }) => {
  await ensureWeeklyMenuGenerated(page)

  await page.reload()
  await expect(page.getByTestId('weekly-summary-card')).toBeVisible()
  await expect(page.getByTestId('weekly-featured-day')).toBeVisible()
  await expect(page.getByTestId('weekly-day-card')).toHaveCount(7)
})

test('weekly weather panel always shows seven day cards for the active week', async ({ page }) => {
  await waitForRouteReady(page, '/weekly-menu', page.getByRole('heading', { name: '週間献立' }))
  await expandWeeklyWeather(page)

  const weatherCards = page.getByTestId('weekly-weather-card')
  await expect(weatherCards).toHaveCount(7)
  await expect(page.getByTestId('weekly-weather-label')).toHaveCount(7)
  await expect(weatherCards.first()).toHaveAttribute('data-weather-variant', /.+/)
})

test('weekly shopping list opens after menu generation', async ({ page }) => {
  await ensureWeeklyMenuGenerated(page)
  await page.getByTestId('weekly-featured-day').getByRole('button', { name: '買い物リスト' }).click()

  const shoppingListPanel = page.getByTestId('weekly-shopping-list-panel')
  await expect(shoppingListPanel.getByRole('heading', { name: '買い物リスト' })).toBeVisible()
  await expect(shoppingListPanel).toContainText('不足材料')
})

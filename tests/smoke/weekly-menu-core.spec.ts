import { expect, test, type Page } from '@playwright/test'
import { ensureWeeklyMenuGenerated, expandWeeklyWeather, waitForRouteReady } from '../support/app'
import { expectLocatorWithinViewport } from '../support/layout'

async function readWeeklyMainTitles(page: Page) {
  const cards = page.getByTestId('weekly-day-card')
  const count = await cards.count()
  const titles = new Map<string, string>()
  for (let index = 0; index < count; index += 1) {
    const card = cards.nth(index)
    const date = await card.getAttribute('data-day-date')
    const title = (await card.getByTestId('weekly-day-title').innerText()).trim()
    if (date) titles.set(date, title)
  }
  return titles
}

test('weekly menu generation creates and persists summary and 7 day cards', async ({ page }) => {
  await ensureWeeklyMenuGenerated(page)

  await page.reload()
  await expect(page.getByTestId('weekly-summary-card')).toBeVisible()
  await expect(page.getByTestId('weekly-featured-day')).toBeVisible()
  await expect(page.getByTestId('weekly-day-card')).toHaveCount(7)
  await expect(page.getByText('推薦理由（簡易）')).toHaveCount(0)
  await expect(page.getByTestId('weekly-summary-card')).not.toContainText('Days')
  await expect(page.getByTestId('weekly-summary-card')).not.toContainText('Locked')
  await expect(page.getByTestId('weekly-summary-card')).not.toContainText('Missing')
})

test('weekly weather panel always shows seven day cards for the active week', async ({ page }) => {
  await waitForRouteReady(page, '/weekly-menu', page.getByRole('heading', { name: '週間献立' }))
  await expandWeeklyWeather(page)

  const weatherCards = page.getByTestId('weekly-weather-card')
  await expect(weatherCards).toHaveCount(7)
  await expect(page.getByTestId('weekly-weather-label')).toHaveCount(7)
  await expect(weatherCards.first()).toHaveAttribute('data-weather-variant', /.+/)
})

test('weekly shopping list and action dock stay inside the mobile viewport', async ({ page }) => {
  await ensureWeeklyMenuGenerated(page)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

  const actionBar = page.getByTestId('weekly-action-bar')
  await expectLocatorWithinViewport(page, actionBar)

  await actionBar.getByRole('button', { name: '買い物リスト', exact: true }).click()

  const shoppingListPanel = page.getByTestId('weekly-shopping-list-panel')
  await expect(shoppingListPanel.getByRole('heading', { name: '買い物リスト' })).toBeVisible()
  await expect(shoppingListPanel).toContainText('不足材料')
  await expectLocatorWithinViewport(page, shoppingListPanel)
})

test('weekly gantt modal stays inside the mobile viewport', async ({ page }) => {
  await ensureWeeklyMenuGenerated(page)

  await page.getByTestId('weekly-featured-day').getByTestId('weekly-timeline-trigger').click()

  const ganttModal = page.getByTestId('weekly-gantt-modal')
  await expect(ganttModal).toContainText('調理スケジュール')
  await expectLocatorWithinViewport(page, ganttModal)
  await expectLocatorWithinViewport(page, page.getByTestId('weekly-gantt-scroll'))
})

test('weekly menu can be regenerated without exposing feature matrix constraint errors', async ({ page }) => {
  await ensureWeeklyMenuGenerated(page)
  await page.reload()
  await expect(page.getByTestId('weekly-summary-card')).toBeVisible()
  const beforeTitles = await readWeeklyMainTitles(page)

  await page.getByRole('button', { name: '再生成', exact: true }).click()
  await expect(page.getByText(/週間献立を更新しました/)).toBeVisible()
  await expect(page.getByTestId('weekly-summary-card')).toBeVisible()
  await expect(page.getByTestId('weekly-regenerate-diff-summary')).toContainText('主菜変更')
  await expect(page.getByText(/ConstraintError|bulkPut|recipeFeatureMatrix/)).toHaveCount(0)

  const afterTitles = await readWeeklyMainTitles(page)
  let changedDays = 0
  for (const [date, title] of beforeTitles.entries()) {
    if (afterTitles.get(date) !== title) changedDays += 1
  }
  expect(changedDays).toBeGreaterThanOrEqual(5)
})

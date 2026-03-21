import { expect, test } from '@playwright/test'
import { waitForRouteReady } from '../support/app'
import { expectLocatorWithinViewport } from '../support/layout'

test('search keeps typed Japanese query order and only syncs the URL after blur', async ({ page }) => {
  await waitForRouteReady(page, '/search', page.getByPlaceholder('レシピを検索...'))

  const input = page.getByPlaceholder('レシピを検索...')
  await input.fill('')
  await input.type('てばもと', { delay: 60 })
  await page.waitForTimeout(300)

  await expect(input).toHaveValue('てばもと')
  await expect(page).not.toHaveURL(/[?&]q=/)

  await input.blur()

  await expect(page).toHaveURL(/q=%E3%81%A6%E3%81%B0%E3%82%82%E3%81%A8/)
})

test('search category filters stay inside the viewport without horizontal scrolling', async ({ page }) => {
  await waitForRouteReady(page, '/search', page.getByPlaceholder('レシピを検索...'))

  const categoryGrid = page.getByTestId('search-category-grid')
  const sweetsButton = page.getByRole('button', { name: /スイーツ/ })

  await expect(page.getByTestId('search-recent-viewed')).toHaveCount(0)
  await expectLocatorWithinViewport(page, categoryGrid)
  await expectLocatorWithinViewport(page, sweetsButton)
  await expect(categoryGrid).toBeVisible()
  await expect.poll(async () => categoryGrid.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBeTruthy()
})

test('search facet buttons combine with AND semantics and update the URL', async ({ page }) => {
  await waitForRouteReady(page, '/search', page.getByPlaceholder('レシピを検索...'))

  await page.getByPlaceholder('レシピを検索...').fill('鶏')
  await page.getByTestId('search-device-filters').getByRole('button', { name: 'ホットクック' }).click()
  await page.getByTestId('search-condition-filters').getByRole('button', { name: '時短 30分以内' }).click()
  await page.getByRole('button', { name: /主菜/ }).click()

  await expect(page.getByTestId('search-active-facets')).toContainText('ホットクック')
  await expect(page.getByTestId('search-active-facets')).toContainText('時短 30分以内')
  await expect(page.getByTestId('search-active-facets')).toContainText('主菜')
  await expect(page).toHaveURL(/q=%E9%B6%8F&devices=hotcook&categories=%E4%B8%BB%E8%8F%9C&quick=1/)
})

test('stock manager renders and accepts search input', async ({ page }) => {
  await waitForRouteReady(page, '/stock', page.getByRole('heading', { name: '在庫管理' }))

  const input = page.getByPlaceholder('食材・調味料を検索...')
  await input.fill('ぴー')

  await expect(input).toHaveValue('ぴー')
})

test('settings page renders tab list', async ({ page }) => {
  await waitForRouteReady(page, '/settings', page.getByRole('heading', { name: '設定', exact: true }))
  await expect(page.getByText('よく使う設定をまとめました')).toBeVisible()
  await expect(page.getByRole('button', { name: /接続/ })).toBeVisible()
})

test('legacy settings route redirects to the new AI tab', async ({ page }) => {
  await waitForRouteReady(page, '/settings/menu', page.getByRole('heading', { name: 'AI', exact: true }))
  await expect(page.getByText('Gemini API（AI連携機能）の設定')).toBeVisible()
})

test('help center groups tasks and links directly to the target flow', async ({ page }) => {
  await waitForRouteReady(page, '/settings/help', page.getByRole('heading', { name: 'ヘルプ', exact: true }))
  await expect(page.getByText('今の目的からすぐ進めます')).toBeVisible()
  await expect(page.getByTestId('help-group')).toHaveCount(4)

  await page.getByRole('button', { name: /よく使う操作/ }).click()
  const searchArticle = page.locator('[data-article-id="search-fast"]')
  await searchArticle.getByRole('button').first().click()
  await expect(searchArticle).toContainText('条件ボタンは組み合わせて使えます')

  await searchArticle.getByRole('button', { name: '検索へ移動' }).click()
  await expect(page).toHaveURL(/\/search$/)
  await expect(page.getByPlaceholder('レシピを検索...')).toBeVisible()
})

test('appearance mode persists after reload', async ({ page }) => {
  await waitForRouteReady(page, '/settings', page.getByRole('heading', { name: '設定', exact: true }))
  await page.getByRole('button', { name: '表示' }).click()
  await expect(page.getByTestId('appearance-settings')).toBeVisible()

  const darkButton = page.getByTestId('appearance-mode-dark')
  await darkButton.click()

  await expect(darkButton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.waitForFunction(() => localStorage.getItem('appearance_mode_v1') === 'dark')

  await page.reload()
  await expect(page.getByTestId('appearance-settings')).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByTestId('appearance-mode-dark')).toHaveAttribute('aria-pressed', 'true')
})

test('recipe detail updates favorites and history pages', async ({ page }) => {
  await waitForRouteReady(page, '/recipe/1', page.getByRole('heading', { name: '材料', exact: true }).first())
  const recipeTitle = (await page.locator('header h1').first().innerText()).trim()

  const favoriteButton = page.getByTestId('recipe-favorite-button')
  await favoriteButton.click()
  await expect(favoriteButton).toHaveAttribute('aria-label', 'お気に入りを解除')

  await waitForRouteReady(page, '/favorites', page.getByRole('heading', { name: 'お気に入り' }))
  await expect(page.getByText(recipeTitle).first()).toBeVisible()

  await waitForRouteReady(page, '/history', page.getByRole('heading', { name: '閲覧履歴' }))
  await expect(page.getByText(recipeTitle).first()).toBeVisible()
})

test('settings persist desired meal time after reload', async ({ page }) => {
  await waitForRouteReady(page, '/settings/planning', page.getByRole('heading', { name: '献立', exact: true }))

  const planningSettings = page.getByTestId('planning-schedule-settings')
  const updatedAtBefore = await planningSettings.getAttribute('data-preferences-updated-at')
  const desiredMealHour = page.getByTestId('desired-meal-hour')
  const desiredMealMinute = page.getByTestId('desired-meal-minute')
  const initialHour = await desiredMealHour.inputValue()
  const initialMinute = await desiredMealMinute.inputValue()
  const nextHour = initialHour === '19' ? '20' : '19'
  const nextMinute = initialMinute === '15' ? '20' : '15'

  await desiredMealHour.fill(nextHour)
  await desiredMealHour.blur()
  await expect(planningSettings).not.toHaveAttribute('data-preferences-updated-at', updatedAtBefore ?? '')
  const updatedAtAfterHour = await planningSettings.getAttribute('data-preferences-updated-at')

  await desiredMealMinute.fill(nextMinute)
  await desiredMealMinute.blur()
  await expect.poll(async () => planningSettings.getAttribute('data-preferences-updated-at')).not.toBe(updatedAtAfterHour)
  await expect(desiredMealMinute).toHaveValue(nextMinute)

  await page.reload()
  await expect(page.getByTestId('planning-schedule-settings')).toBeVisible()
  await expect(page.getByTestId('desired-meal-hour')).toHaveValue(nextHour)
  await expect(page.getByTestId('desired-meal-minute')).toHaveValue(nextMinute)
})

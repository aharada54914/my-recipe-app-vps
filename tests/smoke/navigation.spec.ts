import { expect, test } from '@playwright/test'
import { waitForRouteReady } from '../support/app'

test('search keeps typed Japanese query order', async ({ page }) => {
  await waitForRouteReady(page, '/search', page.getByPlaceholder('レシピを検索...'))

  const input = page.getByPlaceholder('レシピを検索...')
  await input.fill('')
  await input.type('ぴー', { delay: 60 })

  await expect(input).toHaveValue('ぴー')
})

test('stock manager renders and accepts search input', async ({ page }) => {
  await waitForRouteReady(page, '/stock', page.getByRole('heading', { name: '在庫管理' }))

  const input = page.getByPlaceholder('食材・調味料を検索...')
  await input.fill('ぴー')

  await expect(input).toHaveValue('ぴー')
})

test('settings page renders tab list', async ({ page }) => {
  await waitForRouteReady(page, '/settings', page.getByRole('heading', { name: '設定', exact: true }))
  await expect(page.getByText('設定を行いたい項目をお選びください')).toBeVisible()
})

test('appearance mode persists after reload', async ({ page }) => {
  await waitForRouteReady(page, '/settings', page.getByRole('heading', { name: '設定', exact: true }))
  await page.getByRole('button', { name: '表示' }).click()
  await expect(page.getByTestId('appearance-settings')).toBeVisible()

  const darkButton = page.getByTestId('appearance-mode-dark')
  await darkButton.click()

  await expect(darkButton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

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
  await waitForRouteReady(page, '/settings/notify', page.getByRole('heading', { name: '通知', exact: true }))

  const notificationSettings = page.getByTestId('notification-settings')
  const updatedAtBefore = await notificationSettings.getAttribute('data-preferences-updated-at')
  const desiredMealHour = page.getByTestId('desired-meal-hour')
  const desiredMealMinute = page.getByTestId('desired-meal-minute')

  await desiredMealHour.fill('19')
  await desiredMealHour.blur()
  await desiredMealMinute.fill('15')
  await desiredMealMinute.blur()
  await expect(notificationSettings).not.toHaveAttribute('data-preferences-updated-at', updatedAtBefore ?? '')

  await page.reload()
  await expect(page.getByTestId('notification-settings')).toBeVisible()
  await expect(page.getByTestId('desired-meal-hour')).toHaveValue('19')
  await expect(page.getByTestId('desired-meal-minute')).toHaveValue('15')
})

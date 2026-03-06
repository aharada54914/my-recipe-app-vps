import { test, expect, type Locator, type Page } from '@playwright/test'

async function waitForRouteReady(page: Page, path: string, readyLocator: Locator) {
  await page.goto(path)
  await expect(readyLocator).toBeVisible()
}

test('home shows core entry points', async ({ page }) => {
  await waitForRouteReady(page, '/', page.getByRole('button', { name: '在庫管理' }))
  await expect(page.getByText('レシピを検索...')).toBeVisible()
})

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

test('weekly menu page renders its primary heading', async ({ page }) => {
  await waitForRouteReady(page, '/weekly-menu', page.getByRole('heading', { name: '週間献立' }))
  const createButton = page.getByRole('button', { name: '献立を自動生成', exact: true })

  if (await createButton.isVisible()) {
    await expect(page.getByText('この週の献立はまだ生成されていません', { exact: true })).toBeVisible()
    return
  }

  await expect(page.getByText('栄養バランス評価', { exact: true })).toBeVisible()
})

test('settings page renders tab list', async ({ page }) => {
  await waitForRouteReady(page, '/settings', page.getByRole('heading', { name: '設定', exact: true }))
  await expect(page.getByText('設定を行いたい項目をお選びください')).toBeVisible()
})

test('recipe detail route loads a seeded recipe', async ({ page }) => {
  await waitForRouteReady(page, '/recipe/1', page.getByRole('heading', { name: '材料', exact: true }).first())
  await expect(page.getByText('信頼度')).toBeVisible()
})

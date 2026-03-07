import { test, expect, type Locator, type Page } from '@playwright/test'

async function waitForRouteReady(page: Page, path: string, readyLocator: Locator) {
  await page.goto(path)
  await expect(readyLocator).toBeVisible()
}

async function ensureWeeklyMenuGenerated(page: Page) {
  await waitForRouteReady(page, '/weekly-menu', page.getByRole('heading', { name: '週間献立' }))
  const generateButton = page.getByRole('button', { name: '献立を自動生成', exact: true }).first()
  if (await generateButton.isVisible()) {
    await generateButton.click()
  }
  await expect(page.getByText('栄養バランス評価', { exact: true })).toBeVisible()
  await expect(page.getByTestId('weekly-day-card')).toHaveCount(7)
}

async function addStockItem(page: Page, name: string, quantity: string) {
  const input = page.getByPlaceholder('食材・調味料を検索...')
  await input.fill('')
  await input.fill(name)
  const row = page.locator(`[data-testid="stock-row"][data-stock-name="${name}"]`).first()
  await expect(row).toBeVisible()
  const quantityInput = row.locator('input').first()
  await quantityInput.fill(quantity)
  await quantityInput.blur()
  await expect(page.getByTestId('stock-inventory').locator(`[data-stock-name="${name}"]`).first()).toBeVisible()
}

async function readMatchRate(page: Page, query: string, recipeTitle: string): Promise<number> {
  await waitForRouteReady(page, '/search', page.getByPlaceholder('レシピを検索...'))
  const input = page.getByPlaceholder('レシピを検索...')
  await input.fill('')
  await input.fill(query)
  const card = page.locator('.recipe-card').filter({ hasText: recipeTitle }).first()
  await expect(card).toBeVisible()
  const badgeText = await card.getByText(/在庫\s+\d+%/).innerText()
  const match = badgeText.match(/(\d+)%/)
  if (!match) throw new Error(`Could not parse match rate from: ${badgeText}`)
  return Number(match[1])
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

test('weekly menu generation creates and persists 7 daily cards', async ({ page }) => {
  await ensureWeeklyMenuGenerated(page)

  await page.reload()
  await expect(page.getByText('栄養バランス評価', { exact: true })).toBeVisible()
  await expect(page.getByTestId('weekly-day-card')).toHaveCount(7)
  await expect(page.getByRole('button', { name: '主菜を変更' })).toHaveCount(7)
})

test('weekly menu swap replaces the first main dish and persists after reload', async ({ page }) => {
  await ensureWeeklyMenuGenerated(page)

  const firstDayCard = page.getByTestId('weekly-day-card').first()
  const originalTitle = await firstDayCard.locator('h3').first().innerText()

  await page.getByRole('button', { name: '主菜を変更' }).first().click()
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
  await expect(firstDayCard.locator('h3').first()).toHaveText(selectedTitle!)

  await page.reload()
  await expect(page.getByTestId('weekly-day-card').first().locator('h3').first()).toHaveText(selectedTitle!)
})

test('stock registration increases search match rate for a seeded recipe', async ({ page }) => {
  const recipeTitle = '[1人分]きんぴら(もっとクック専用)'
  const before = await readMatchRate(page, 'きんぴら', recipeTitle)

  await waitForRouteReady(page, '/stock', page.getByRole('heading', { name: '在庫管理' }))
  await addStockItem(page, 'ごぼう', '1')
  await addStockItem(page, 'にんじん', '1')

  const after = await readMatchRate(page, 'きんぴら', recipeTitle)
  expect(after).toBeGreaterThan(before)
})

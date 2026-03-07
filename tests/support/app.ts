import { expect, type Locator, type Page } from '@playwright/test'

export async function waitForRouteReady(page: Page, path: string, readyLocator: Locator) {
  await page.goto(path)
  await expect(readyLocator).toBeVisible()
}

export async function ensureWeeklyMenuGenerated(page: Page) {
  await waitForRouteReady(page, '/weekly-menu', page.getByRole('heading', { name: '週間献立' }))
  const generateButton = page.getByRole('button', { name: '献立を自動生成', exact: true }).first()
  if (await generateButton.isVisible()) {
    await generateButton.click()
  }
  await expect(page.getByTestId('weekly-summary-card')).toBeVisible()
  await expect(page.getByTestId('weekly-day-card')).toHaveCount(7)
}

export async function addStockItem(page: Page, name: string, quantity: string) {
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

export async function expandWeeklyWeather(page: Page) {
  const weatherToggle = page.getByRole('button', { name: '今週の東京都天気カードを展開' })
  await expect(weatherToggle).toBeVisible()
  if ((await weatherToggle.getAttribute('aria-expanded')) !== 'true') {
    await weatherToggle.click()
  }
}

export async function readMatchRate(page: Page, query: string, recipeTitle: string): Promise<number> {
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

export async function seedLegacyGeminiKey(page: Page, value = 'test-gemini-key') {
  await page.addInitScript((key: string) => {
    localStorage.setItem('gemini_api_key', key)
  }, value)
}

export async function applyTestClock(page: Page) {
  await page.addInitScript(() => {
    const fixed = new Date('2026-03-07T09:00:00+09:00').valueOf()
    const RealDate = Date
    class MockDate extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        if (args.length === 0) {
          super(fixed)
          return
        }
        super(...args)
      }
      static now() {
        return fixed
      }
    }
    Object.setPrototypeOf(MockDate, RealDate)
    // @ts-expect-error runtime override for deterministic tests
    window.Date = MockDate
  })
}

export async function applyTheme(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((nextTheme: 'light' | 'dark') => {
    localStorage.setItem('appearance_mode_v1', nextTheme)
  }, theme)
}

export async function applyDeterministicRandom(page: Page, seed = 12345) {
  await page.addInitScript((initialSeed: number) => {
    let current = initialSeed >>> 0
    Math.random = () => {
      current = (current * 1664525 + 1013904223) >>> 0
      return current / 0x100000000
    }
  }, seed)
}

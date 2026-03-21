import { expect, type Locator, type Page } from '@playwright/test'

export async function expectLocatorWithinViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible()

  const box = await locator.boundingBox()
  if (!box) {
    throw new Error('Target locator has no bounding box')
  }

  const viewport = page.viewportSize()
  if (!viewport) {
    throw new Error('Viewport size is unavailable')
  }

  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.y).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
}

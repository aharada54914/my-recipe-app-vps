import { expect, test } from '@playwright/test'
import { waitForRouteReady } from '../support/app'

test('home prioritizes search and Gemini in the first viewport', async ({ page }) => {
  await waitForRouteReady(page, '/', page.getByTestId('home-primary-search'))

  await expect(page.getByTestId('home-primary-search')).toBeVisible()
  await expect(page.getByTestId('home-primary-gemini')).toBeVisible()
  await expect(page.getByTestId('home-weekly-summary')).toBeVisible()

  const bottomNav = page.getByTestId('bottom-nav')
  await expect(bottomNav.getByRole('button', { name: 'ホーム' })).toHaveAttribute('aria-current', 'page')
  await expect(bottomNav.getByRole('button', { name: '献立' })).toBeVisible()
  await expect(bottomNav.getByRole('button', { name: 'Gemini' })).toBeVisible()
})

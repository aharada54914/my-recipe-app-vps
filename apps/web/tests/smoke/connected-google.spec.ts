import { expect, test } from '@playwright/test'
import { waitForRouteReady } from '../support/app'

test('qa google mode exercises connected account and calendar flows', async ({ page }) => {
  await waitForRouteReady(page, '/settings/data?qa-google=1', page.getByText('Google 連携 QA モード'))

  await expect(page.getByTestId('qa-google-backup')).toBeVisible()
  await page.getByTestId('qa-google-backup').click()

  await waitForRouteReady(page, '/settings/account', page.getByText('Google ログインとバックアップ'))
  await expect(page.getByText('QA Google')).toBeVisible()
  await expect(page.getByTestId('account-google-status')).toContainText('QA 用の Google 連携を使用中です')

  await waitForRouteReady(page, '/recipe/1', page.getByRole('heading', { name: '材料', exact: true }).first())
  await page.getByRole('button', { name: 'カレンダーに登録' }).click()
  await expect(page.getByTestId('calendar-registration-modal')).toBeVisible()
  await expect(page.getByTestId('calendar-registration-status')).toContainText('QA 用のカレンダー接続を使用中です')
})

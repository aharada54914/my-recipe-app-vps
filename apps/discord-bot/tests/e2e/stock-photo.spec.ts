import { test } from '@playwright/test'
import { getDiscordE2EConfig, isDiscordE2EEnabled } from './fixtures/config'
import { DiscordAppPage } from './pageObjects/DiscordAppPage'
import { DiscordThreadPage } from './pageObjects/DiscordThreadPage'

test.describe('Discord stock-photo flow', () => {
  test.skip(!isDiscordE2EEnabled(), 'Discord E2E is disabled')

  test('analyze-photo submits the slash command and opens the stock thread flow', async ({ page }) => {
    const config = getDiscordE2EConfig()
    test.skip(!config.stockPhotoAutomationEnabled, 'Stock photo slash command automation is not enabled for this run')
    test.skip(!config.stockPhotoImagePath, 'DISCORD_E2E_STOCK_PHOTO_IMAGE_PATH is not configured')

    const discord = new DiscordAppPage(page, config)

    await discord.gotoStockPhotoChannel()
    await discord.expectBotMessageContaining('#stock-photo の使い方')
    await discord.runSlashCommandWithAttachment('analyze-photo', config.stockPhotoImagePath!, ['3'])
    if (!config.stockPhotoExpectSuccess) {
      await discord.expectBotMessageContaining('写真解析に失敗しました:')
      return
    }

    await discord.expectBotMessageContaining('候補を作成しました')
    await discord.openLatestThreadByPrefix('stock-photo-')

    const thread = new DiscordThreadPage(page)
    await thread.expectThreadHeaderContains('stock-photo')
    await thread.expectMessageContains('写真解析案')
    await thread.expectMessageContains('在庫に保存')
    await thread.expectMessageContains('食材を編集')
  })

  test('stock save modal opens with editable CSV-style lines', async ({ page }) => {
    const config = getDiscordE2EConfig()
    test.skip(!config.stockPhotoAutomationEnabled, 'Stock photo slash command automation is not enabled for this run')
    test.skip(!config.stockPhotoImagePath, 'DISCORD_E2E_STOCK_PHOTO_IMAGE_PATH is not configured')
    test.skip(!config.stockPhotoExpectSuccess, 'Stock photo happy path requires Gemini quota')

    const discord = new DiscordAppPage(page, config)
    await discord.gotoStockPhotoChannel()
    await discord.openLatestThreadByPrefix('stock-photo-')

    const thread = new DiscordThreadPage(page)
    await thread.clickButton('在庫に保存')
    await thread.expectModalField('1行=action,食材名,既存在庫名,数量,単位,購入日,賞味期限')

    if (!config.stockPhotoSaveLines) return

    await thread.fillVisibleModal([
      {
        label: '1行=action,食材名,既存在庫名,数量,単位,購入日,賞味期限',
        value: config.stockPhotoSaveLines,
      },
    ])
    await thread.expectMessageContains('在庫保存')
  })
})

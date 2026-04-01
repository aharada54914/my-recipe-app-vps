import { test } from '@playwright/test'
import { getDiscordE2EConfig, isDiscordE2EEnabled } from './fixtures/config'
import { DiscordAppPage } from './pageObjects/DiscordAppPage'
import { DiscordThreadPage } from './pageObjects/DiscordThreadPage'

test.describe('Discord recipe-import flow', () => {
  test.skip(!isDiscordE2EEnabled(), 'Discord E2E is disabled')

  test('import-url creates a review thread with approval controls', async ({ page }) => {
    const config = getDiscordE2EConfig()
    test.skip(!config.recipeImportUrl, 'DISCORD_E2E_RECIPE_IMPORT_URL is not configured')

    const discord = new DiscordAppPage(page, config)

    await discord.gotoRecipeImportChannel()
    await discord.expectBotMessageContaining('#recipe-import の使い方')
    await discord.runSlashCommand('import-url', [config.recipeImportUrl!, '3'])
    await discord.expectBotMessageContaining('下書きを作成しました')
    await discord.openLatestThreadByPrefix('recipe-import-')

    const thread = new DiscordThreadPage(page)
    await thread.expectThreadHeaderContains('recipe-import')
    await thread.expectMessageContains('URL取込下書き')
    await thread.expectMessageContains('登録OK')
    await thread.expectMessageContains('基本情報を編集')
  })
})

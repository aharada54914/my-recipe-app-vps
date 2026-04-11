import { test } from '@playwright/test'
import { getDiscordE2EConfig, isDiscordE2EEnabled } from './fixtures/config'
import { DiscordAppPage } from './pageObjects/DiscordAppPage'

test.describe('Discord help channel and command routing', () => {
  test.skip(!isDiscordE2EEnabled(), 'Discord E2E is disabled')

  test('help channel exposes top-level guidance and /help works', async ({ page }) => {
    const config = getDiscordE2EConfig()
    const discord = new DiscordAppPage(page, config)

    await discord.gotoHelpChannel()
    await discord.expectBotMessageContaining('Kitchen Assistant の総合ヘルプです')
    await discord.expectBotMessageContaining('#weekly-menu')

    await discord.runSlashCommand('help')
    await discord.expectBotMessageContaining('aharada server の使い方')
  })

  test('weekly-menu guidance is available from help in the weekly-menu channel', async ({ page }) => {
    const config = getDiscordE2EConfig()
    const discord = new DiscordAppPage(page, config)

    await discord.gotoWeeklyMenuChannel()
    await discord.expectChannelTextContaining(config.weeklyMenuChannelId, '#weekly-menu の使い方')
    await discord.expectChannelTextContaining(config.weeklyMenuChannelId, '/plan-week')
    await discord.expectChannelTextContaining(config.weeklyMenuChannelId, '/plan-day')
    await discord.expectChannelTextContaining(config.weeklyMenuChannelId, '保存して家族カレンダーへ登録')
  })
})

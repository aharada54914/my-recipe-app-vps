import { test } from '@playwright/test'
import { getDiscordE2EConfig, isDiscordE2EEnabled } from './fixtures/config'
import { DiscordAppPage } from './pageObjects/DiscordAppPage'
import { DiscordThreadPage } from './pageObjects/DiscordThreadPage'

test.describe('Discord weekly-menu flow', () => {
  test.skip(!isDiscordE2EEnabled(), 'Discord E2E is disabled')

  test('plan-day creates a thread for the current day', async ({ page }) => {
    const config = getDiscordE2EConfig()
    const discord = new DiscordAppPage(page, config)

    await discord.gotoWeeklyMenuChannel()
    await discord.runSlashCommand('plan-day', ['3', 'さっぱり', 'E2E daily menu smoke'])
    await discord.expectChannelTextContaining(config.weeklyMenuChannelId, '当日メニュー案を作成しました')
    const openedThread = await discord.openThreadFromLatestAnnouncement(
      config.weeklyMenuChannelId,
      '当日メニュー案を作成しました',
    )

    const thread = new DiscordThreadPage(page, openedThread.threadId)
    await thread.expectThreadNameStartsWith('daily-menu')
    await thread.expectMessageContains('当日メニュー案')
    await thread.expectMessageContains('次点候補へ')
    await thread.expectMessageContains('保存して家族カレンダーへ登録')
  })

  test('plan-week creates a thread and exposes replacement controls', async ({ page }) => {
    const config = getDiscordE2EConfig()
    const discord = new DiscordAppPage(page, config)

    await discord.gotoWeeklyMenuChannel()
    await discord.runSlashCommand('plan-week', ['3', '魚多め', 'E2E weekly menu smoke'])
    await discord.expectChannelTextContaining(config.weeklyMenuChannelId, '献立案を作成しました')
    const openedThread = await discord.openThreadFromLatestAnnouncement(
      config.weeklyMenuChannelId,
      '献立案を作成しました',
    )

    const thread = new DiscordThreadPage(page, openedThread.threadId)
    await thread.expectThreadNameStartsWith('weekly-menu')
    await thread.expectMessageContains('週間献立案')
    await thread.expectMessageContains('次点候補へ')
    await thread.expectMessageContains('今週はもう出さない')
    await thread.expectMessageContains('保存して家族カレンダーへ登録')
  })

  test('replacement modal accepts avoid-same-main-ingredient input', async ({ page }) => {
    const config = getDiscordE2EConfig()
    const discord = new DiscordAppPage(page, config)

    await discord.gotoWeeklyMenuChannel()
    const openedThread = await discord.openThreadFromLatestAnnouncement(
      config.weeklyMenuChannelId,
      '献立案を作成しました',
    )

    const thread = new DiscordThreadPage(page, openedThread.threadId)
    await thread.clickButton('次点候補へ')
    await thread.fillVisibleModal([
      { label: /何日目を差し替えるか \(1(?:-\d+)?\)/, value: '1' },
      { label: '対象 (main / side)', value: 'main' },
      { label: '避けたいものや希望', value: 'E2E replacement smoke' },
      { label: '同じ主材料を避ける (yes / no)', value: 'yes' },
    ])
    await thread.expectMessageContains('同じ主材料は避けています')
  })
})

import { test } from '@playwright/test'
import { getDiscordE2EConfig, isDiscordE2EEnabled } from './fixtures/config'
import { DiscordAppPage } from './pageObjects/DiscordAppPage'
import { DiscordThreadPage } from './pageObjects/DiscordThreadPage'

test.describe('Discord weekly-menu flow', () => {
  test.skip(!isDiscordE2EEnabled(), 'Discord E2E is disabled')

  test('plan-week creates a thread and exposes replacement controls', async ({ page }) => {
    const config = getDiscordE2EConfig()
    const discord = new DiscordAppPage(page, config)

    await discord.gotoWeeklyMenuChannel()
    await discord.runSlashCommand('plan-week', ['3', '魚多め', 'E2E weekly menu smoke'])
    await discord.expectBotMessageContaining('献立案を作成しました')
    await discord.openLatestThreadByPrefix('weekly-menu-')

    const thread = new DiscordThreadPage(page)
    await thread.expectThreadHeaderContains('weekly-menu')
    await thread.expectMessageContains('週間献立案')
    await thread.expectMessageContains('次点候補へ')
    await thread.expectMessageContains('今週はもう出さない')
    await thread.expectMessageContains('保存して家族カレンダーへ登録')
  })

  test('replacement modal accepts avoid-same-main-ingredient input', async ({ page }) => {
    const config = getDiscordE2EConfig()
    const discord = new DiscordAppPage(page, config)

    await discord.gotoWeeklyMenuChannel()
    await discord.openLatestThreadByPrefix('weekly-menu-')

    const thread = new DiscordThreadPage(page)
    await thread.clickButton('次点候補へ')
    await thread.fillVisibleModal([
      { label: '何日目を差し替えるか (1-7)', value: '1' },
      { label: '対象 (main / side)', value: 'main' },
      { label: '避けたいものや希望', value: 'E2E replacement smoke' },
      { label: '同じ主材料を避ける (yes / no)', value: 'yes' },
    ])
    await thread.expectMessageContains('同じ主材料は避けています')
  })
})

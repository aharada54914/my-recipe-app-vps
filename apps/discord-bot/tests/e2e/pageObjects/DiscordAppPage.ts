import fs from 'node:fs'
import path from 'node:path'
import { expect, type Locator, type Page } from '@playwright/test'
import type { DiscordE2EConfig } from '../fixtures/config'

type DiscordMessage = {
  content?: string
  embeds?: Array<{ title?: string; description?: string }>
  components?: Array<{ components?: Array<{ label?: string }> }>
}

type DiscordChannel = {
  id: string
  name?: string
}

export type OpenedDiscordThread = {
  threadId: string
  threadName: string
}

let cachedDiscordToken: string | null = null

function getDiscordStorageStatePath(): string {
  return process.env.DISCORD_E2E_STORAGE_STATE
    ?? path.resolve(process.cwd(), 'tests/e2e/.auth/discord-user.json')
}

function getDiscordAuthToken(): string {
  if (cachedDiscordToken) return cachedDiscordToken

  const rawState = fs.readFileSync(getDiscordStorageStatePath(), 'utf8')
  const storageState = JSON.parse(rawState) as {
    origins?: Array<{
      origin?: string
      localStorage?: Array<{ name?: string; value?: string }>
    }>
  }
  const discordOrigin = storageState.origins?.find((origin) => origin.origin?.includes('discord.com'))
  const tokenEntry = discordOrigin?.localStorage?.find((entry) => entry.name === 'token')
  if (!tokenEntry?.value) {
    throw new Error('Discord auth token is missing from storage state')
  }

  cachedDiscordToken = JSON.parse(tokenEntry.value) as string
  return cachedDiscordToken
}

export class DiscordAppPage {
  constructor(
    private readonly page: Page,
    private readonly config: DiscordE2EConfig,
  ) {}

  async gotoChannel(channelId: string): Promise<void> {
    await this.page.goto(`/channels/${this.config.guildId}/${channelId}`)
    await this.waitForAppReady()
  }

  async gotoHelpChannel(): Promise<void> {
    await this.gotoChannel(this.config.helpChannelId)
  }

  async gotoWeeklyMenuChannel(): Promise<void> {
    await this.gotoChannel(this.config.weeklyMenuChannelId)
  }

  async gotoRecipeImportChannel(): Promise<void> {
    await this.gotoChannel(this.config.recipeImportChannelId)
  }

  async gotoStockPhotoChannel(): Promise<void> {
    await this.gotoChannel(this.config.stockPhotoChannelId)
  }

  async waitForAppReady(): Promise<void> {
    await expect(this.page.getByRole('textbox').last()).toBeVisible()
  }

  composer(): Locator {
    return this.page.getByRole('textbox').last()
  }

  private async selectSlashCommand(commandName: string): Promise<void> {
    const composer = this.composer()
    await composer.click()
    await composer.fill(`/${commandName}`)
    const option = this.page.locator('[role="option"]', { hasText: `/${commandName}` }).first()
    await expect(option).toBeVisible()
    await option.click()
    await this.page.waitForTimeout(300)
  }

  async runSlashCommand(commandName: string, optionValues: string[] = []): Promise<void> {
    await this.selectSlashCommand(commandName)

    for (const value of optionValues) {
      await this.page.keyboard.type(value)
      await this.page.keyboard.press('Tab')
    }

    await this.page.keyboard.press('Enter')
    if (optionValues.length === 0) {
      await this.page.keyboard.press('Enter')
    }
  }

  async runSlashCommandWithAttachment(
    commandName: string,
    attachmentPath: string,
    optionValues: string[] = [],
  ): Promise<void> {
    await this.selectSlashCommand(commandName)

    const fileInput = this.page.locator('input[class*="fileInput_"]').first()
    await expect(fileInput).toBeAttached()
    await fileInput.setInputFiles(attachmentPath)
    await this.page.waitForTimeout(300)

    for (const [index, value] of optionValues.entries()) {
      const pill = this.page.locator('.optionPill__1464f').filter({ hasNotText: 'image' }).nth(index)
      await expect(pill).toBeVisible()
      await pill.click()
      await this.page.keyboard.type(value)
      await this.page.waitForTimeout(150)
    }

    await this.page.keyboard.press('Enter')
  }

  async openLatestThreadByPrefix(prefix: string): Promise<void> {
    const threadLink = this.page.getByRole('link').filter({ hasText: prefix }).last()
    await expect(threadLink).toBeVisible()
    await threadLink.click({ force: true })
    await this.waitForAppReady()
  }

  async expectBotMessageContaining(text: string): Promise<void> {
    await expect(this.page.getByText(text).last()).toBeVisible()
  }

  async expectChannelTextContaining(channelId: string, text: string): Promise<void> {
    await expect.poll(async () => {
      const messages = await this.fetchChannelMessages(channelId)
      return messages.some((message) => this.messageContains(message, text))
    }).toBe(true)
  }

  async openThreadFromLatestAnnouncement(
    channelId: string,
    announcementText: string,
  ): Promise<OpenedDiscordThread> {
    let openedThread: OpenedDiscordThread | null = null
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const messages = await this.fetchChannelMessages(channelId)
      const announcement = messages.find((message) => message.content?.includes(announcementText))
      const match = announcement?.content?.match(/<#(\d+)>/)
      if (match?.[1]) {
        const thread = await this.fetchChannel(match[1])
        openedThread = {
          threadId: thread.id,
          threadName: thread.name ?? '',
        }
        break
      }
      await this.page.waitForTimeout(1000)
    }

    if (!openedThread) {
      throw new Error(`Latest announcement thread not found for: ${announcementText}`)
    }

    await this.gotoChannel(openedThread.threadId)
    await expect.poll(() => this.page.title()).toContain(openedThread.threadName)
    return openedThread
  }

  private async fetchChannelMessages(channelId: string): Promise<DiscordMessage[]> {
    const response = await fetch(`https://discord.com/api/v9/channels/${channelId}/messages?limit=50`, {
      headers: { Authorization: getDiscordAuthToken() },
    })
    if (!response.ok) {
      throw new Error(`Discord messages fetch failed: ${response.status}`)
    }
    return response.json() as Promise<DiscordMessage[]>
  }

  private async fetchChannel(channelId: string): Promise<DiscordChannel> {
    const response = await fetch(`https://discord.com/api/v9/channels/${channelId}`, {
      headers: { Authorization: getDiscordAuthToken() },
    })
    if (!response.ok) {
      throw new Error(`Discord channel fetch failed: ${response.status}`)
    }
    return response.json() as Promise<DiscordChannel>
  }

  private messageContains(message: DiscordMessage, text: string): boolean {
    if (message.content?.includes(text)) return true
    if (message.embeds?.some((embed) =>
      embed.title?.includes(text) || embed.description?.includes(text),
    )) {
      return true
    }
    return message.components?.some((row) =>
      row.components?.some((component) => component.label?.includes(text)),
    ) ?? false
  }
}

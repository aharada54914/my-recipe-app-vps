import fs from 'node:fs'
import path from 'node:path'
import { expect, type Page } from '@playwright/test'

type DiscordThreadMessage = {
  content?: string
  embeds?: Array<{ title?: string; description?: string }>
  components?: Array<{ components?: Array<{ label?: string }> }>
}

type DiscordThreadChannel = {
  id: string
  name?: string
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

export class DiscordThreadPage {
  constructor(
    private readonly page: Page,
    private readonly threadId: string,
  ) {}

  async expectThreadNameStartsWith(prefix: string): Promise<void> {
    await expect.poll(async () => {
      const channel = await this.fetchThreadChannel()
      return channel.name ?? ''
    }).toContain(prefix)
  }

  async clickButton(label: string): Promise<void> {
    await this.expectMessageContains(label)
    const button = this.page.locator('button').filter({ hasText: label }).last()
    await expect(button).toBeVisible()
    await button.click({ force: true })
  }

  async fillVisibleModal(fields: Array<{ label: string | RegExp; value: string }>): Promise<void> {
    const dialog = this.page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    for (const [index, field] of fields.entries()) {
      const labeledInput = dialog.getByLabel(field.label).last()
      const fallbackInput = dialog.locator('input[type="text"], textarea').nth(index)
      const input = await labeledInput.isVisible({ timeout: 1000 }).catch(() => false)
        ? labeledInput
        : fallbackInput

      await expect(input).toBeVisible()
      await input.fill(field.value)
    }
    await dialog.getByRole('button', { name: /送信|Submit|保存/ }).last().click()
  }

  async expectModalField(label: string): Promise<void> {
    await expect(this.page.getByLabel(label).last()).toBeVisible()
  }

  async expectMessageContains(text: string): Promise<void> {
    await expect.poll(async () => {
      const messages = await this.fetchCurrentThreadMessages()
      if (messages.some((message) => this.messageContains(message, text))) {
        return true
      }

      const bodyText = await this.page.locator('body').textContent()
      return bodyText?.includes(text) ?? false
    }).toBe(true)
  }

  private async fetchCurrentThreadMessages(): Promise<DiscordThreadMessage[]> {
    const response = await fetch(`https://discord.com/api/v9/channels/${this.threadId}/messages?limit=20`, {
      headers: { Authorization: getDiscordAuthToken() },
    })
    if (!response.ok) {
      throw new Error(`Discord thread messages fetch failed: ${response.status}`)
    }
    return response.json() as Promise<DiscordThreadMessage[]>
  }

  private async fetchThreadChannel(): Promise<DiscordThreadChannel> {
    const response = await fetch(`https://discord.com/api/v9/channels/${this.threadId}`, {
      headers: { Authorization: getDiscordAuthToken() },
    })
    if (!response.ok) {
      throw new Error(`Discord thread channel fetch failed: ${response.status}`)
    }
    return response.json() as Promise<DiscordThreadChannel>
  }

  private messageContains(message: DiscordThreadMessage, text: string): boolean {
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

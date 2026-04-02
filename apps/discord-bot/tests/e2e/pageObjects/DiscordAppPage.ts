import { expect, type Locator, type Page } from '@playwright/test'
import type { DiscordE2EConfig } from '../fixtures/config'

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
    await threadLink.click()
    await this.waitForAppReady()
  }

  async expectBotMessageContaining(text: string): Promise<void> {
    await expect(this.page.getByText(text).last()).toBeVisible()
  }
}

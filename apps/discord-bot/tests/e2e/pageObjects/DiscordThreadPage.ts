import { expect, type Page } from '@playwright/test'

export class DiscordThreadPage {
  constructor(private readonly page: Page) {}

  async expectThreadHeaderContains(text: string): Promise<void> {
    await expect(this.page.getByText(text).first()).toBeVisible()
  }

  async clickButton(label: string): Promise<void> {
    const button = this.page.getByRole('button', { name: label }).last()
    await expect(button).toBeVisible()
    await button.click()
  }

  async fillVisibleModal(fields: Array<{ label: string; value: string }>): Promise<void> {
    for (const field of fields) {
      const input = this.page.getByLabel(field.label).last()
      await expect(input).toBeVisible()
      await input.fill(field.value)
    }
    await this.page.getByRole('button', { name: /送信|Submit|保存/ }).last().click()
  }

  async expectModalField(label: string): Promise<void> {
    await expect(this.page.getByLabel(label).last()).toBeVisible()
  }

  async expectMessageContains(text: string): Promise<void> {
    await expect(this.page.getByText(text).last()).toBeVisible()
  }
}

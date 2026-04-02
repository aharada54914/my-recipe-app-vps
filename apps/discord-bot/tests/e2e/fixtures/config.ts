export type DiscordE2EConfig = {
  guildId: string
  helpChannelId: string
  weeklyMenuChannelId: string
  stockPhotoChannelId: string
  recipeImportChannelId: string
  kitchenAdviceChannelId: string
  recipeImportUrl?: string
  stockPhotoImagePath?: string
  stockPhotoSaveLines?: string
  stockPhotoExpectSuccess: boolean
  stockPhotoAutomationEnabled: boolean
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required Discord E2E env: ${name}`)
  }
  return value
}

export function isDiscordE2EEnabled(): boolean {
  return process.env.DISCORD_E2E_ENABLED === '1'
}

export function getDiscordE2EConfig(): DiscordE2EConfig {
  return {
    guildId: getRequiredEnv('DISCORD_E2E_GUILD_ID'),
    helpChannelId: getRequiredEnv('DISCORD_E2E_HELP_CHANNEL_ID'),
    weeklyMenuChannelId: getRequiredEnv('DISCORD_E2E_WEEKLY_MENU_CHANNEL_ID'),
    stockPhotoChannelId: getRequiredEnv('DISCORD_E2E_STOCK_PHOTO_CHANNEL_ID'),
    recipeImportChannelId: getRequiredEnv('DISCORD_E2E_RECIPE_IMPORT_CHANNEL_ID'),
    kitchenAdviceChannelId: getRequiredEnv('DISCORD_E2E_KITCHEN_ADVICE_CHANNEL_ID'),
    recipeImportUrl: process.env.DISCORD_E2E_RECIPE_IMPORT_URL,
    stockPhotoImagePath: process.env.DISCORD_E2E_STOCK_PHOTO_IMAGE_PATH,
    stockPhotoSaveLines: process.env.DISCORD_E2E_STOCK_PHOTO_SAVE_LINES,
    stockPhotoExpectSuccess: process.env.DISCORD_E2E_STOCK_PHOTO_EXPECT_SUCCESS === '1',
    stockPhotoAutomationEnabled: process.env.DISCORD_E2E_STOCK_PHOTO_AUTOMATION === '1',
  }
}

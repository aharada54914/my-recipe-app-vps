import {
  ActionRowBuilder,
  ChannelType,
  Client,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js'
import { z } from 'zod'
import {
  type DiscordWorkflow,
  EditableRecipeCategorySchema,
  type RecipeImportDraftSummary,
  UpdateDiscordRecipeImportDraftRequestSchema,
} from '@kitchen/shared-types'
import {
  approveRecipeImportDraft,
  bindWorkflowChannel,
  cancelRecipeImportDraft,
  createRecipeImportDraft,
  getRecipeImportDraft,
  getWorkflowChannel,
  updateRecipeImportDraft,
} from './lib/apiClient.js'
import { buildRecipeImportDraftMessage } from './lib/messages.js'
import {
  buildWeeklyMenuCommand,
  handlePlanWeekCommand,
  handleWeeklyMenuButton,
  handleWeeklyMenuModal,
} from './workflows/weeklyMenu.js'
import {
  buildStockPhotoCommand,
  handleAnalyzePhotoCommand,
  handleStockPhotoButton,
  handleStockPhotoModal,
} from './workflows/stockPhoto.js'
import {
  buildKitchenAdviceCommand,
  handleKitchenAdviceButton,
  handleKitchenAdviceCommand,
} from './workflows/kitchenAdvice.js'

const WORKFLOW_CHOICES = [
  ['URLレシピ取込', 'recipe_import'],
  ['週間献立', 'weekly_menu'],
  ['写真で在庫提案', 'stock_photo'],
  ['料理相談', 'kitchen_advice'],
] as const

const RecipeImportButtonSchema = z.object({
  scope: z.literal('recipe-import'),
  action: z.enum(['edit', 'refresh', 'approve', 'cancel']),
  draftId: z.coerce.number().int().positive(),
})

const RecipeImportModalSchema = z.object({
  scope: z.literal('recipe-import-modal'),
  draftId: z.coerce.number().int().positive(),
  messageId: z.string().min(1),
})

function getRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

function buildCommands() {
  return [
    new SlashCommandBuilder()
      .setName('bind-channel')
      .setDescription('現在のチャンネルを Kitchen workflow に紐付けます')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption((option) =>
        option
          .setName('workflow')
          .setDescription('紐付ける workflow')
          .setRequired(true)
          .addChoices(...WORKFLOW_CHOICES.map(([name, value]) => ({ name, value }))),
      ),
    new SlashCommandBuilder()
      .setName('import-url')
      .setDescription('レシピURLを解析して確認後にDB登録します')
      .addStringOption((option) =>
        option.setName('url').setDescription('対応サイトのURL').setRequired(true),
      )
      .addIntegerOption((option) =>
        option.setName('servings').setDescription('今回は何人分か').setRequired(true).setMinValue(1).setMaxValue(20),
      ),
    buildWeeklyMenuCommand(),
    buildStockPhotoCommand(),
    buildKitchenAdviceCommand(),
  ].map((command) => command.toJSON())
}

function parseRecipeImportButton(customId: string) {
  const [scope, action, draftId] = customId.split(':')
  return RecipeImportButtonSchema.parse({ scope, action, draftId })
}

function parseRecipeImportModal(customId: string) {
  const [scope, draftId, messageId] = customId.split(':')
  return RecipeImportModalSchema.parse({ scope, draftId, messageId })
}

async function registerCommands(): Promise<void> {
  const token = getRequiredEnv('DISCORD_BOT_TOKEN')
  const applicationId = getRequiredEnv('DISCORD_APPLICATION_ID')
  const guildId = getRequiredEnv('DISCORD_GUILD_ID')
  const rest = new REST({ version: '10' }).setToken(token)

  await rest.put(Routes.applicationGuildCommands(applicationId, guildId), {
    body: buildCommands(),
  })
}

async function ensureWorkflowChannel(interaction: ChatInputCommandInteraction, workflow: DiscordWorkflow): Promise<boolean> {
  const guildId = interaction.guildId
  const channelId = interaction.channelId
  if (!guildId) {
    await interaction.reply({ content: 'Guild 内でのみ実行できます。', ephemeral: true })
    return false
  }

  const boundChannelId = await getWorkflowChannel({ guildId, workflow })
  if (!boundChannelId) {
    await interaction.reply({
      content: `この workflow はまだチャンネル未設定です。対象チャンネルで \`/bind-channel workflow:${workflow}\` を先に実行してください。`,
      ephemeral: true,
    })
    return false
  }

  if (boundChannelId !== channelId) {
    await interaction.reply({
      content: `このコマンドは紐付け済みチャンネルでのみ使えます。現在の workflow チャンネル: <#${boundChannelId}>`,
      ephemeral: true,
    })
    return false
  }

  return true
}

async function handleBindChannel(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'Guild 内でのみ実行できます。', ephemeral: true })
    return
  }

  const workflow = interaction.options.getString('workflow', true) as DiscordWorkflow
  await bindWorkflowChannel({
    guildId: interaction.guildId,
    workflow,
    channelId: interaction.channelId,
  })

  await interaction.reply({
    content: `このチャンネルを \`${workflow}\` 用に紐付けました。`,
    ephemeral: true,
  })
}

async function handleImportUrl(interaction: ChatInputCommandInteraction): Promise<void> {
  const allowed = await ensureWorkflowChannel(interaction, 'recipe_import')
  if (!allowed) return

  const url = interaction.options.getString('url', true)
  const servings = interaction.options.getInteger('servings', true)

  await interaction.reply({
    content: `URL を解析しています。今回は **${servings}人分** 前提で下書きを作ります。`,
  })

  const replyMessage = await interaction.fetchReply()
  let threadId: string | undefined

  if (replyMessage.channel.type === ChannelType.GuildText) {
    const thread = await replyMessage.startThread({
      name: `recipe-import-${Date.now()}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      reason: 'Kitchen recipe import review',
    })
    threadId = thread.id
  }

  try {
    const draft = await createRecipeImportDraft({
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      ...(threadId ? { threadId } : {}),
      discordUserId: interaction.user.id,
      requestedServings: servings,
      url,
    })

    const destination = threadId
      ? await interaction.client.channels.fetch(threadId)
      : interaction.channel

    if (destination && 'send' in destination) {
      await destination.send(buildRecipeImportDraftMessage(draft))
    }

    await interaction.editReply({
      content: threadId
        ? `下書きを作成しました。確認と承認は <#${threadId}> で行ってください。`
        : '下書きを作成しました。下のメッセージから確認してください。',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await interaction.editReply({
      content: `URL取込に失敗しました: ${message}`,
    })
  }
}

async function openRecipeImportEditModal(interaction: ButtonInteraction, draft: RecipeImportDraftSummary): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`recipe-import-modal:${draft.id}:${interaction.message.id}`)
    .setTitle(`下書き #${draft.id} を編集`)

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('レシピ名')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(draft.title)

  const deviceInput = new TextInputBuilder()
    .setCustomId('device')
    .setLabel('デバイス (hotcook / healsio / manual)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(draft.device)

  const categoryInput = new TextInputBuilder()
    .setCustomId('category')
    .setLabel('カテゴリ (主菜 / 副菜 / スープ / 一品料理 / スイーツ)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(draft.category)

  const servingsInput = new TextInputBuilder()
    .setCustomId('baseServings')
    .setLabel('元レシピの基準人数')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(draft.baseServings))

  const timeInput = new TextInputBuilder()
    .setCustomId('totalTimeMinutes')
    .setLabel('所要時間(分)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue(String(draft.totalTimeMinutes))

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(deviceInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(categoryInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(servingsInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
  )

  await interaction.showModal(modal)
}

async function handleRecipeImportButton(interaction: ButtonInteraction): Promise<void> {
  const parsed = parseRecipeImportButton(interaction.customId)
  const draft = await getRecipeImportDraft(parsed.draftId)

  if (parsed.action === 'edit') {
    await openRecipeImportEditModal(interaction, draft)
    return
  }

  if (parsed.action === 'refresh') {
    await interaction.update(buildRecipeImportDraftMessage(draft))
    return
  }

  if (parsed.action === 'approve') {
    try {
      const approved = await approveRecipeImportDraft({
        id: draft.id,
        discordUserId: interaction.user.id,
      })
      await interaction.update(buildRecipeImportDraftMessage(approved))
      await interaction.followUp({
        content: `レシピを登録しました。今回は **${approved.requestedServings}人分** で依頼され、元レシピは **${approved.baseServings}人分** です。`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await interaction.reply({
        content: `登録できませんでした: ${message}`,
        ephemeral: true,
      })
    }
    return
  }

  const cancelled = await cancelRecipeImportDraft({
    id: draft.id,
    discordUserId: interaction.user.id,
  })
  await interaction.update(buildRecipeImportDraftMessage(cancelled))
}

async function handleRecipeImportModal(interaction: ModalSubmitInteraction): Promise<void> {
  const parsed = parseRecipeImportModal(interaction.customId)
  const patch = UpdateDiscordRecipeImportDraftRequestSchema.parse({
    title: interaction.fields.getTextInputValue('title').trim(),
    device: interaction.fields.getTextInputValue('device').trim(),
    category: interaction.fields.getTextInputValue('category').trim(),
    baseServings: Number.parseInt(interaction.fields.getTextInputValue('baseServings').trim(), 10),
    totalTimeMinutes: Number.parseInt(interaction.fields.getTextInputValue('totalTimeMinutes').trim(), 10),
  })

  const updated = await updateRecipeImportDraft({
    id: parsed.draftId,
    discordUserId: interaction.user.id,
    patch: {
      ...patch,
      category: EditableRecipeCategorySchema.parse(patch.category),
    },
  })

  const channel = interaction.channel
  if (channel?.isTextBased()) {
    const message = await channel.messages.fetch(parsed.messageId)
    await message.edit(buildRecipeImportDraftMessage(updated))
  }

  await interaction.reply({
    content: `下書きを更新しました。今回は **${updated.requestedServings}人分**、元レシピは **${updated.baseServings}人分** です。`,
    ephemeral: true,
  })
}

async function main(): Promise<void> {
  const token = getRequiredEnv('DISCORD_BOT_TOKEN')
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  })

  client.once('clientReady', async (readyClient) => {
    await registerCommands()
    readyClient.user.setActivity('Kitchen workflows')
    console.log(`Discord bot ready: ${readyClient.user.tag}`)
  })

  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'bind-channel') {
          await handleBindChannel(interaction)
          return
        }
        if (interaction.commandName === 'import-url') {
          await handleImportUrl(interaction)
          return
        }
        if (interaction.commandName === 'plan-week') {
          await handlePlanWeekCommand(interaction, ensureWorkflowChannel)
          return
        }
        if (interaction.commandName === 'analyze-photo') {
          await handleAnalyzePhotoCommand(interaction, ensureWorkflowChannel)
          return
        }
        if (interaction.commandName === 'ask-cooking') {
          await handleKitchenAdviceCommand(interaction, ensureWorkflowChannel)
          return
        }
        return
      }

      if (interaction.isButton()) {
        if (await handleWeeklyMenuButton(interaction)) return
        if (await handleStockPhotoButton(interaction)) return
        if (await handleKitchenAdviceButton(interaction)) return
        if (interaction.customId.startsWith('recipe-import:')) {
          await handleRecipeImportButton(interaction)
          return
        }
      }

      if (interaction.isModalSubmit()) {
        if (await handleWeeklyMenuModal(interaction)) return
        if (await handleStockPhotoModal(interaction)) return
        if (interaction.customId.startsWith('recipe-import-modal:')) {
          await handleRecipeImportModal(interaction)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `処理に失敗しました: ${message}`, ephemeral: true })
        return
      }

      if (interaction.isRepliable()) {
        await interaction.followUp({ content: `処理に失敗しました: ${message}`, ephemeral: true })
      }
    }
  })

  await client.login(token)
}

void main()

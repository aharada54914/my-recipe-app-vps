import {
  ActionRowBuilder,
  ChannelType,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from 'discord.js'
import { z } from 'zod'
import { type DiscordWorkflow } from '@kitchen/shared-types'
import {
  cancelPhotoAnalysisDraft,
  createPhotoAnalysisDraft,
  getPhotoAnalysisDraft,
  savePhotoDetectedStocks,
  selectPhotoCandidate,
  updatePhotoAnalysisDraft,
} from '../lib/apiClient.js'
import { buildPhotoAnalysisMessage } from '../lib/messages.js'

const StockPhotoButtonSchema = z.object({
  scope: z.literal('stock-photo'),
  action: z.enum(['pick1', 'pick2', 'pick3', 'edit', 'save-stock', 'refresh', 'cancel']),
  draftId: z.coerce.number().int().positive(),
})

const StockPhotoModalSchema = z.object({
  scope: z.literal('stock-photo-modal'),
  action: z.enum(['ingredients', 'save-stock']),
  draftId: z.coerce.number().int().positive(),
  messageId: z.string().min(1),
})

export function buildStockPhotoCommand() {
  return new SlashCommandBuilder()
    .setName('analyze-photo')
    .setDescription('写真から食材を抽出し、在庫と合わせてレシピ候補を出します')
    .addAttachmentOption((option) =>
      option.setName('image').setDescription('冷蔵庫や食材の写真').setRequired(true),
    )
    .addIntegerOption((option) =>
      option.setName('servings').setDescription('今回は何人分か').setRequired(true).setMinValue(1).setMaxValue(20),
    )
}

function parseStockPhotoButton(customId: string) {
  const [scope, action, draftId] = customId.split(':')
  return StockPhotoButtonSchema.parse({ scope, action, draftId })
}

function parseStockPhotoModal(customId: string) {
  const [scope, action, draftId, messageId] = customId.split(':')
  return StockPhotoModalSchema.parse({ scope, action, draftId, messageId })
}

async function openIngredientsModal(interaction: ButtonInteraction, draftId: number, ingredients: string[]): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`stock-photo-modal:ingredients:${draftId}:${interaction.message.id}`)
    .setTitle('抽出食材を編集')

  const ingredientsInput = new TextInputBuilder()
    .setCustomId('ingredients')
    .setLabel('食材一覧（読点または改行区切り）')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue(ingredients.join('、'))

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(ingredientsInput),
  )

  await interaction.showModal(modal)
}

async function openSaveStockModal(
  interaction: ButtonInteraction,
  draftId: number,
  ingredients: Array<{ name: string; confidence: number; matchedStockName?: string; suggestedStockAction?: 'merge' | 'create' }>,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`stock-photo-modal:save-stock:${draftId}:${interaction.message.id}`)
    .setTitle('在庫として保存')

  const stockInput = new TextInputBuilder()
    .setCustomId('stockLines')
    .setLabel('1行=action,食材名,既存在庫名,数量,単位,購入日,賞味期限')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setValue(
      ingredients
        .map((ingredient) => `${ingredient.suggestedStockAction ?? 'create'},${ingredient.name},${ingredient.matchedStockName ?? ''},1,個,,`)
        .join('\n')
        .slice(0, 3900),
    )

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(stockInput),
  )

  await interaction.showModal(modal)
}

export async function handleAnalyzePhotoCommand(
  interaction: ChatInputCommandInteraction,
  ensureWorkflowChannel: (interaction: ChatInputCommandInteraction, workflow: DiscordWorkflow) => Promise<boolean>,
): Promise<void> {
  const allowed = await ensureWorkflowChannel(interaction, 'stock_photo')
  if (!allowed) return

  const image = interaction.options.getAttachment('image', true)
  const servings = interaction.options.getInteger('servings', true)

  await interaction.reply({
    content: `写真を解析しています。今回は **${servings}人分** で候補を作ります。`,
  })

  const replyMessage = await interaction.fetchReply()
  let threadId: string | undefined
  if (replyMessage.channel.type === ChannelType.GuildText) {
    const thread = await replyMessage.startThread({
      name: `stock-photo-${Date.now()}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      reason: 'Kitchen stock photo analysis',
    })
    threadId = thread.id
  }

  try {
    const draft = await createPhotoAnalysisDraft({
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      ...(threadId ? { threadId } : {}),
      discordUserId: interaction.user.id,
      requestedServings: servings,
      imageUrl: image.url,
    })

    const destination = threadId
      ? await interaction.client.channels.fetch(threadId)
      : interaction.channel

    if (destination && 'send' in destination) {
      await destination.send(buildPhotoAnalysisMessage(draft))
    }

    await interaction.editReply({
      content: threadId
        ? `候補を作成しました。確認と承認は <#${threadId}> で行ってください。`
        : '候補を作成しました。',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await interaction.editReply({ content: `写真解析に失敗しました: ${message}` })
  }
}

export async function handleStockPhotoButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith('stock-photo:')) return false

  const parsed = parseStockPhotoButton(interaction.customId)
  const draft = await getPhotoAnalysisDraft(parsed.draftId)

  if (parsed.action === 'edit') {
    await openIngredientsModal(interaction, draft.id, draft.detectedIngredients.map((item) => item.name))
    return true
  }

  if (parsed.action === 'save-stock') {
    await openSaveStockModal(interaction, draft.id, draft.detectedIngredients)
    return true
  }

  if (parsed.action === 'refresh') {
    const refreshed = await updatePhotoAnalysisDraft({
      id: draft.id,
      discordUserId: interaction.user.id,
      excludeRecipeIds: draft.candidates.map((candidate) => candidate.recipeId),
    })
    await interaction.update(buildPhotoAnalysisMessage(refreshed))
    return true
  }

  if (parsed.action === 'cancel') {
    const cancelled = await cancelPhotoAnalysisDraft({
      id: draft.id,
      discordUserId: interaction.user.id,
    })
    await interaction.update(buildPhotoAnalysisMessage(cancelled))
    return true
  }

  const index = parsed.action === 'pick1' ? 0 : parsed.action === 'pick2' ? 1 : 2
  const candidate = draft.candidates[index]
  if (!candidate) {
    await interaction.reply({ content: 'その候補は見つかりません。', ephemeral: true })
    return true
  }

  const approved = await selectPhotoCandidate({
    id: draft.id,
    discordUserId: interaction.user.id,
    recipeId: candidate.recipeId,
  })
  await interaction.update(buildPhotoAnalysisMessage(approved))
  return true
}

export async function handleStockPhotoModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith('stock-photo-modal:')) return false

  const parsed = parseStockPhotoModal(interaction.customId)
  await interaction.deferReply({ ephemeral: true })

  const ingredients = interaction.fields
    .getTextInputValue(parsed.action === 'save-stock' ? 'stockLines' : 'ingredients')

  if (parsed.action === 'save-stock') {
    const items = ingredients
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [actionRaw, name, existingStockNameRaw, quantityRaw, unitRaw, purchasedAtRaw, expiresAtRaw] = line.split(',').map((part) => part.trim())
        const quantity = Number(quantityRaw || '1')
        const action: 'merge' | 'replace' | 'create' | 'skip' = actionRaw === 'merge' || actionRaw === 'replace' || actionRaw === 'skip'
          ? actionRaw
          : 'create'
        return {
          action,
          name,
          ...(existingStockNameRaw ? { existingStockName: existingStockNameRaw } : {}),
          quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          unit: unitRaw || '個',
          ...(purchasedAtRaw ? { purchasedAt: new Date(`${purchasedAtRaw}T00:00:00`) } : {}),
          ...(expiresAtRaw ? { expiresAt: new Date(`${expiresAtRaw}T00:00:00`) } : {}),
        }
      })
      .filter((item) => item.name.length > 0)

    try {
      const draft = await getPhotoAnalysisDraft(parsed.draftId)
      const confidenceMap = new Map(draft.detectedIngredients.map((item) => [item.name, item.confidence]))
      const updated = await savePhotoDetectedStocks({
        id: parsed.draftId,
        discordUserId: interaction.user.id,
        items: items.map((item) => ({
          ...item,
          ...(confidenceMap.has(item.name) ? { detectionConfidence: confidenceMap.get(item.name) } : {}),
        })),
      })
      const channel = interaction.channel
      if (channel && 'messages' in channel) {
        const message = await channel.messages.fetch(parsed.messageId)
        await message.edit(buildPhotoAnalysisMessage(updated))
      }
      await interaction.editReply(`在庫を ${items.length} 件保存しました。`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await interaction.editReply(`在庫保存に失敗しました: ${message}`)
    }

    return true
  }

  const ingredientNames = ingredients
    .split(/[、,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  try {
    const updated = await updatePhotoAnalysisDraft({
      id: parsed.draftId,
      discordUserId: interaction.user.id,
      ingredients: ingredientNames,
    })
    const channel = interaction.channel
    if (channel && 'messages' in channel) {
      const message = await channel.messages.fetch(parsed.messageId)
      await message.edit(buildPhotoAnalysisMessage(updated))
    }
    await interaction.editReply('抽出食材を更新しました。')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await interaction.editReply(`食材の更新に失敗しました: ${message}`)
  }

  return true
}

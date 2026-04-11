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
import { type DiscordWorkflow, type MenuPlanningMode, type WeeklyMenuPreset } from '@kitchen/shared-types'
import {
  approveWeeklyMenuProposal,
  cancelWeeklyMenuProposal,
  createWeeklyMenuProposal,
  getWeeklyMenuProposal,
  replaceWeeklyMenuItem,
} from '../lib/apiClient.js'
import { buildWeeklyMenuProposalMessage } from '../lib/messages.js'

const WeeklyMenuButtonSchema = z.object({
  scope: z.literal('weekly-menu'),
  action: z.enum(['next', 'blacklist', 'refresh', 'approve', 'cancel']),
  proposalId: z.coerce.number().int().positive(),
})

const WeeklyMenuModalSchema = z.object({
  scope: z.literal('weekly-menu-modal'),
  action: z.enum(['next', 'blacklist', 'refresh']),
  proposalId: z.coerce.number().int().positive(),
  messageId: z.string().min(1),
})

function buildMenuCommand(name: string, description: string) {
  return new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addIntegerOption((option) =>
      option.setName('servings').setDescription('今回は何人分か').setRequired(true).setMinValue(1).setMaxValue(20),
    )
    .addStringOption((option) =>
      option
        .setName('preset')
        .setDescription('テンプレ条件')
        .addChoices(
          { name: '和食多め', value: 'washoku_focus' },
          { name: '節約重視', value: 'budget_saver' },
          { name: '魚多め', value: 'fish_more' },
        ),
    )
    .addStringOption((option) =>
      option.setName('notes').setDescription('避けたい料理や希望').setMaxLength(400),
    )
}

export function buildWeeklyMenuCommand() {
  return buildMenuCommand('plan-week', '実行日から次の日曜日までの献立案を作ります')
}

export function buildDailyMenuCommand() {
  return buildMenuCommand('plan-day', 'その日だけの献立案を作ります')
}

function getPresetLabel(preset?: WeeklyMenuPreset): string | null {
  if (preset === 'washoku_focus') return '和食多め'
  if (preset === 'budget_saver') return '節約重視'
  if (preset === 'fish_more') return '魚多め'
  return null
}

function parseWeeklyMenuButton(customId: string) {
  const [scope, action, proposalId] = customId.split(':')
  return WeeklyMenuButtonSchema.parse({ scope, action, proposalId })
}

function parseWeeklyMenuModal(customId: string) {
  const [scope, action, proposalId, messageId] = customId.split(':')
  return WeeklyMenuModalSchema.parse({ scope, action, proposalId, messageId })
}

async function openReplaceModal(
  interaction: ButtonInteraction,
  proposalId: number,
  action: 'next' | 'blacklist' | 'refresh',
  dayCount: number,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`weekly-menu-modal:${action}:${proposalId}:${interaction.message.id}`)
    .setTitle(
      action === 'blacklist'
        ? '候補を今週から除外'
        : action === 'refresh'
          ? '在庫優先で再探索'
          : '次点候補に差し替え',
    )

  const dayIndex = new TextInputBuilder()
    .setCustomId('dayIndex')
    .setLabel(dayCount === 1 ? '何日目を差し替えるか (1)' : `何日目を差し替えるか (1-${dayCount})`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue('1')

  const target = new TextInputBuilder()
    .setCustomId('target')
    .setLabel('対象 (main / side)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('省略時は main')

  const notes = new TextInputBuilder()
    .setCustomId('notes')
    .setLabel('避けたいものや希望')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setPlaceholder('例: 揚げ物以外、魚以外、もっとさっぱり')

  const avoidMainIngredient = new TextInputBuilder()
    .setCustomId('avoidSameMainIngredient')
    .setLabel('同じ主材料を避ける (yes / no)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('主菜差し替え時だけ有効。省略時は no')

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(dayIndex),
    new ActionRowBuilder<TextInputBuilder>().addComponents(target),
    new ActionRowBuilder<TextInputBuilder>().addComponents(notes),
    new ActionRowBuilder<TextInputBuilder>().addComponents(avoidMainIngredient),
  )

  await interaction.showModal(modal)
}

async function handlePlanMenuCommand(
  interaction: ChatInputCommandInteraction,
  ensureWorkflowChannel: (interaction: ChatInputCommandInteraction, workflow: DiscordWorkflow) => Promise<boolean>,
  planningMode: MenuPlanningMode,
): Promise<void> {
  const allowed = await ensureWorkflowChannel(interaction, 'weekly_menu')
  if (!allowed) return

  const servings = interaction.options.getInteger('servings', true)
  const presetRaw = interaction.options.getString('preset')
  const preset = presetRaw === 'washoku_focus' || presetRaw === 'budget_saver' || presetRaw === 'fish_more'
    ? presetRaw as WeeklyMenuPreset
    : undefined
  const notes = interaction.options.getString('notes') ?? undefined
  const presetLabel = getPresetLabel(preset)
  const introLabel = planningMode === 'day' ? '当日メニュー案' : '献立案'
  const threadPrefix = planningMode === 'day' ? 'daily-menu' : 'weekly-menu'

  await interaction.reply({
    content: `${planningMode === 'day' ? '当日メニュー案' : '実行日から次の日曜日までの献立案'}を作っています。今回は **${servings}人分** で進めます${presetLabel ? `。テンプレ条件: **${presetLabel}**` : ''}。`,
  })

  const replyMessage = await interaction.fetchReply()
  let threadId: string | undefined
  if (replyMessage.channel.type === ChannelType.GuildText) {
    const thread = await replyMessage.startThread({
      name: `${threadPrefix}-${Date.now()}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      reason: planningMode === 'day' ? 'Kitchen daily menu review' : 'Kitchen weekly menu review',
    })
    threadId = thread.id
  }

  try {
    const proposal = await createWeeklyMenuProposal({
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      ...(threadId ? { threadId } : {}),
      discordUserId: interaction.user.id,
      requestedServings: servings,
      planningMode,
      ...(preset ? { preset } : {}),
      ...(notes ? { notes } : {}),
    })

    const destination = threadId
      ? await interaction.client.channels.fetch(threadId)
      : interaction.channel

    if (destination && 'send' in destination) {
      await destination.send(buildWeeklyMenuProposalMessage(proposal))
    }

    await interaction.editReply({
      content: threadId
        ? `${introLabel}を作成しました。確認と差し替えは <#${threadId}> で行ってください。`
        : `${introLabel}を作成しました。`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await interaction.editReply({ content: `${introLabel}の作成に失敗しました: ${message}` })
  }
}

export async function handlePlanWeekCommand(
  interaction: ChatInputCommandInteraction,
  ensureWorkflowChannel: (interaction: ChatInputCommandInteraction, workflow: DiscordWorkflow) => Promise<boolean>,
): Promise<void> {
  await handlePlanMenuCommand(interaction, ensureWorkflowChannel, 'week')
}

export async function handlePlanDayCommand(
  interaction: ChatInputCommandInteraction,
  ensureWorkflowChannel: (interaction: ChatInputCommandInteraction, workflow: DiscordWorkflow) => Promise<boolean>,
): Promise<void> {
  await handlePlanMenuCommand(interaction, ensureWorkflowChannel, 'day')
}

export async function handleWeeklyMenuButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith('weekly-menu:')) return false

  const parsed = parseWeeklyMenuButton(interaction.customId)
  const proposal = await getWeeklyMenuProposal(parsed.proposalId)

  if (parsed.action === 'next' || parsed.action === 'blacklist' || parsed.action === 'refresh') {
    await openReplaceModal(interaction, proposal.id, parsed.action, proposal.items.length)
    return true
  }

  if (parsed.action === 'approve') {
    const approved = await approveWeeklyMenuProposal({
      id: proposal.id,
      discordUserId: interaction.user.id,
    })
    await interaction.update(buildWeeklyMenuProposalMessage(approved))
    return true
  }

  const cancelled = await cancelWeeklyMenuProposal({
    id: proposal.id,
    discordUserId: interaction.user.id,
  })
  await interaction.update(buildWeeklyMenuProposalMessage(cancelled))
  return true
}

export async function handleWeeklyMenuModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith('weekly-menu-modal:')) return false

  const parsed = parseWeeklyMenuModal(interaction.customId)
  await interaction.deferReply({ ephemeral: true })
  const proposal = await getWeeklyMenuProposal(parsed.proposalId)
  const maxDayNumber = proposal.items.length

  const dayIndexRaw = interaction.fields.getTextInputValue('dayIndex').trim()
  const targetRaw = interaction.fields.getTextInputValue('target').trim().toLowerCase()
  const notes = interaction.fields.getTextInputValue('notes').trim()
  const dayNumber = Number.parseInt(dayIndexRaw, 10)
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > maxDayNumber) {
    await interaction.editReply(
      maxDayNumber === 1
        ? '差し替える日は 1 を入力してください。'
        : `差し替える日は 1 から ${maxDayNumber} の数字で入力してください。`,
    )
    return true
  }

  const target = targetRaw === 'side' ? 'side' : 'main'
  const avoidSameMainIngredientRaw = interaction.fields.getTextInputValue('avoidSameMainIngredient').trim().toLowerCase()
  const avoidSameMainIngredient = target === 'main' && ['yes', 'y', 'true', '1', 'はい'].includes(avoidSameMainIngredientRaw)
  const strategy = parsed.action === 'blacklist'
    ? 'blacklist_current'
    : parsed.action === 'refresh'
      ? 'rebuild_stock_priority'
      : 'next_candidate'

  try {
    const updated = await replaceWeeklyMenuItem({
      id: parsed.proposalId,
      patch: {
        dayIndex: dayNumber - 1,
        discordUserId: interaction.user.id,
        target,
        strategy,
        ...(avoidSameMainIngredient ? { avoidSameMainIngredient: true } : {}),
        ...(notes ? { notes } : {}),
      },
    })
    const channel = interaction.channel
    if (channel && 'messages' in channel) {
      const message = await channel.messages.fetch(parsed.messageId)
      await message.edit(buildWeeklyMenuProposalMessage(updated))
    }
    await interaction.editReply(
      `${dayNumber}日目の${target === 'side' ? '副菜' : '主菜'}を${parsed.action === 'blacklist' ? '今週の候補から除外して更新' : parsed.action === 'refresh' ? '在庫優先で再探索' : '次点候補に更新'}しました${avoidSameMainIngredient ? '。同じ主材料は避けています。' : ''}`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await interaction.editReply(`差し替えに失敗しました: ${message}`)
  }
  return true
}

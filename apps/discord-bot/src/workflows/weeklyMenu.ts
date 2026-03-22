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
  approveWeeklyMenuProposal,
  cancelWeeklyMenuProposal,
  createWeeklyMenuProposal,
  getWeeklyMenuProposal,
  replaceWeeklyMenuItem,
} from '../lib/apiClient.js'
import { buildWeeklyMenuProposalMessage } from '../lib/messages.js'

const WeeklyMenuButtonSchema = z.object({
  scope: z.literal('weekly-menu'),
  action: z.enum(['replace', 'refresh', 'approve', 'cancel']),
  proposalId: z.coerce.number().int().positive(),
})

const WeeklyMenuModalSchema = z.object({
  scope: z.literal('weekly-menu-modal'),
  proposalId: z.coerce.number().int().positive(),
  messageId: z.string().min(1),
})

export function buildWeeklyMenuCommand() {
  return new SlashCommandBuilder()
    .setName('plan-week')
    .setDescription('東京の天気予報とレシピDBから1週間の献立案を作ります')
    .addIntegerOption((option) =>
      option.setName('servings').setDescription('今回は何人分か').setRequired(true).setMinValue(1).setMaxValue(20),
    )
    .addStringOption((option) =>
      option.setName('notes').setDescription('避けたい料理や希望').setMaxLength(400),
    )
}

function parseWeeklyMenuButton(customId: string) {
  const [scope, action, proposalId] = customId.split(':')
  return WeeklyMenuButtonSchema.parse({ scope, action, proposalId })
}

function parseWeeklyMenuModal(customId: string) {
  const [scope, proposalId, messageId] = customId.split(':')
  return WeeklyMenuModalSchema.parse({ scope, proposalId, messageId })
}

async function openReplaceModal(interaction: ButtonInteraction, proposalId: number): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(`weekly-menu-modal:${proposalId}:${interaction.message.id}`)
    .setTitle('差し替える日を指定')

  const dayIndex = new TextInputBuilder()
    .setCustomId('dayIndex')
    .setLabel('何日目を差し替えるか (1-7)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setValue('1')

  const notes = new TextInputBuilder()
    .setCustomId('notes')
    .setLabel('避けたいものや希望')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setPlaceholder('例: 揚げ物以外、魚以外、もっとさっぱり')

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(dayIndex),
    new ActionRowBuilder<TextInputBuilder>().addComponents(notes),
  )

  await interaction.showModal(modal)
}

export async function handlePlanWeekCommand(
  interaction: ChatInputCommandInteraction,
  ensureWorkflowChannel: (interaction: ChatInputCommandInteraction, workflow: DiscordWorkflow) => Promise<boolean>,
): Promise<void> {
  const allowed = await ensureWorkflowChannel(interaction, 'weekly_menu')
  if (!allowed) return

  const servings = interaction.options.getInteger('servings', true)
  const notes = interaction.options.getString('notes') ?? undefined

  await interaction.reply({
    content: `1週間の献立案を作っています。今回は **${servings}人分** で進めます。`,
  })

  const replyMessage = await interaction.fetchReply()
  let threadId: string | undefined
  if (replyMessage.channel.type === ChannelType.GuildText) {
    const thread = await replyMessage.startThread({
      name: `weekly-menu-${Date.now()}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      reason: 'Kitchen weekly menu review',
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
        ? `献立案を作成しました。確認と差し替えは <#${threadId}> で行ってください。`
        : '献立案を作成しました。',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await interaction.editReply({ content: `週間献立案の作成に失敗しました: ${message}` })
  }
}

export async function handleWeeklyMenuButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith('weekly-menu:')) return false

  const parsed = parseWeeklyMenuButton(interaction.customId)
  const proposal = await getWeeklyMenuProposal(parsed.proposalId)

  if (parsed.action === 'replace') {
    await openReplaceModal(interaction, proposal.id)
    return true
  }

  if (parsed.action === 'refresh') {
    await interaction.update(buildWeeklyMenuProposalMessage(proposal))
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

  const dayIndexRaw = interaction.fields.getTextInputValue('dayIndex').trim()
  const notes = interaction.fields.getTextInputValue('notes').trim()
  const dayNumber = Number.parseInt(dayIndexRaw, 10)
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 7) {
    await interaction.editReply('差し替える日は 1 から 7 の数字で入力してください。')
    return true
  }

  try {
    const updated = await replaceWeeklyMenuItem({
      id: parsed.proposalId,
      patch: {
        dayIndex: dayNumber - 1,
        discordUserId: interaction.user.id,
        ...(notes ? { notes } : {}),
      },
    })
    const channel = interaction.channel
    if (channel && 'messages' in channel) {
      const message = await channel.messages.fetch(parsed.messageId)
      await message.edit(buildWeeklyMenuProposalMessage(updated))
    }
    await interaction.editReply(`${dayNumber}日目を差し替えました。`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await interaction.editReply(`差し替えに失敗しました: ${message}`)
  }
  return true
}

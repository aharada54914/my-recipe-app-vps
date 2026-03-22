import {
  ChannelType,
  SlashCommandBuilder,
  ThreadAutoArchiveDuration,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js'
import { z } from 'zod'
import { type DiscordWorkflow } from '@kitchen/shared-types'
import {
  cancelKitchenAdviceSession,
  createKitchenAdviceSession,
  followUpKitchenAdviceSession,
  getKitchenAdviceSession,
} from '../lib/apiClient.js'
import { buildKitchenAdviceMessage } from '../lib/messages.js'

const KitchenAdviceButtonSchema = z.object({
  scope: z.literal('kitchen-advice'),
  action: z.enum(['detail', 'quick', 'kids', 'swap', 'close']),
  sessionId: z.coerce.number().int().positive(),
})

const FOLLOW_UP_PROMPTS: Record<z.infer<typeof KitchenAdviceButtonSchema>['action'], string> = {
  detail: 'さっきの回答を、失敗しにくいコツまで含めてもっと詳しく教えてください。',
  quick: '同じ相談に対して、できるだけ時短寄りの答えに言い換えてください。',
  kids: '同じ相談に対して、子どもが食べやすい味付けや工夫も含めて答えてください。',
  swap: '同じ相談に対して、代替材料があればそれも含めて答えてください。',
  close: 'close',
}

export function buildKitchenAdviceCommand() {
  return new SlashCommandBuilder()
    .setName('ask-cooking')
    .setDescription('料理のコツや段取りを相談します')
    .addStringOption((option) =>
      option.setName('question').setDescription('相談したい内容').setRequired(true).setMaxLength(500),
    )
    .addIntegerOption((option) =>
      option.setName('servings').setDescription('今回は何人分か').setRequired(true).setMinValue(1).setMaxValue(20),
    )
}

function parseKitchenAdviceButton(customId: string) {
  const [scope, action, sessionId] = customId.split(':')
  return KitchenAdviceButtonSchema.parse({ scope, action, sessionId })
}

export async function handleKitchenAdviceCommand(
  interaction: ChatInputCommandInteraction,
  ensureWorkflowChannel: (interaction: ChatInputCommandInteraction, workflow: DiscordWorkflow) => Promise<boolean>,
): Promise<void> {
  const allowed = await ensureWorkflowChannel(interaction, 'kitchen_advice')
  if (!allowed) return

  const question = interaction.options.getString('question', true)
  const servings = interaction.options.getInteger('servings', true)

  await interaction.reply({
    content: `相談内容を整理しています。今回は **${servings}人分** 前提で答えます。`,
  })

  const replyMessage = await interaction.fetchReply()
  let threadId: string | undefined
  if (replyMessage.channel.type === ChannelType.GuildText) {
    const thread = await replyMessage.startThread({
      name: `kitchen-advice-${Date.now()}`,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      reason: 'Kitchen cooking advice thread',
    })
    threadId = thread.id
  }

  try {
    const session = await createKitchenAdviceSession({
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      ...(threadId ? { threadId } : {}),
      discordUserId: interaction.user.id,
      requestedServings: servings,
      question,
    })

    const destination = threadId
      ? await interaction.client.channels.fetch(threadId)
      : interaction.channel

    if (destination && 'send' in destination) {
      await destination.send(buildKitchenAdviceMessage(session))
    }

    await interaction.editReply({
      content: threadId
        ? `相談スレッドを作成しました。続きは <#${threadId}> で行ってください。`
        : '相談に回答しました。',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await interaction.editReply({ content: `料理相談に失敗しました: ${message}` })
  }
}

export async function handleKitchenAdviceButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith('kitchen-advice:')) return false

  const parsed = parseKitchenAdviceButton(interaction.customId)
  const session = await getKitchenAdviceSession(parsed.sessionId)

  if (parsed.action === 'close') {
    const cancelled = await cancelKitchenAdviceSession({
      id: session.id,
      discordUserId: interaction.user.id,
    })
    await interaction.update(buildKitchenAdviceMessage(cancelled))
    return true
  }

  const prompt = FOLLOW_UP_PROMPTS[parsed.action]
  const updated = await followUpKitchenAdviceSession({
    id: session.id,
    discordUserId: interaction.user.id,
    prompt,
  })
  await interaction.deferUpdate()
  const channel = interaction.channel
  if (channel && 'send' in channel) {
    await channel.send(buildKitchenAdviceMessage(updated))
  }
  return true
}

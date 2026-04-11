import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
  type Guild,
  type GuildBasedChannel,
  type GuildTextBasedChannel,
} from 'discord.js'
import { type DiscordWorkflow } from '@kitchen/shared-types'
import { getWorkflowChannel } from './apiClient.js'

const HELP_CHANNEL_NAME = 'how-to-use'
const HELP_FOOTER_PREFIX = 'kitchen-help'

type HelpTopic = 'overview' | DiscordWorkflow

type WorkflowHelpConfig = {
  channelName: string
  displayName: string
  commandName: string
  example: string
  summary: string
  steps: string[]
  notes: string[]
}

const WORKFLOW_HELP: Record<DiscordWorkflow, WorkflowHelpConfig> = {
  recipe_import: {
    channelName: 'recipe-import',
    displayName: 'URLレシピ取込',
    commandName: '/import-url',
    example: '/import-url url:https://example.com/recipe servings:3',
    summary: 'レシピURLを読み取り、足りない情報を確認してからDBへ登録します。',
    steps: [
      'このチャンネルで `/import-url` を候補から選び、URL と人数を入れて送信します。',
      'Bot が専用スレッドを作り、抽出したレシピ名・人数・カテゴリを表示します。',
      '不足があれば `基本情報を編集` で補います。',
      '`登録OK` を押した時だけ本登録します。',
    ],
    notes: [
      '入力欄にただ `/import-url ...` と打つだけでは動きません。Discord の slash command 候補を必ず選んでください。',
      '毎回「今回何人分か」を入れます。表示には元レシピの基準人数も出ます。',
    ],
  },
  weekly_menu: {
    channelName: 'weekly-menu',
    displayName: '週間献立',
    commandName: '/plan-week',
    example: '/plan-week servings:3 preset:和食多め notes:平日は時短、揚げ物は少なめ',
    summary: '東京の天気、在庫、旬、履歴を使って実行日から日曜までの献立、または当日分だけの献立を提案します。',
    steps: [
      'このチャンネルで `/plan-week` を候補から選び、人数と必要ならテンプレ条件・メモを入れて送信します。',
      '当日だけ欲しいときは `/plan-day` を使います。',
      'Bot が専用スレッドを作り、対象期間ぶんの主菜と副菜候補を表示します。',
      '`次点候補へ` で初回選定の次点を順番に見ます。',
      '`今週はもう出さない` でその候補を今週の提案から除外します。',
      '差し替え時は `同じ主材料を避ける` を yes にすると、同系統の主菜を飛ばせます。',
      '`保存して家族カレンダーへ登録` で週間献立保存と家族カレンダー登録を同時に行います。',
    ],
    notes: [
      'Google 連携と家族カレンダー設定が済んでいると、保存時に家族カレンダーへ自動登録します。',
      '差し替えは毎回人数表示付きです。',
    ],
  },
  stock_photo: {
    channelName: 'stock-photo',
    displayName: '写真で在庫提案',
    commandName: '/analyze-photo',
    example: '/analyze-photo image:<写真を添付> servings:3',
    summary: '写真から食材候補を抽出し、作れそうなレシピと在庫登録候補を出します。',
    steps: [
      'このチャンネルで `/analyze-photo` を候補から選び、写真と人数を入れて送信します。',
      'Bot が専用スレッドを作り、食材候補と信頼度を表示します。',
      '`食材を編集` で誤認識を直せます。',
      '`在庫に保存` で `merge / replace / create / skip` を選び、食材名・数量・購入日・賞味期限を確認して保存します。',
      '`候補1を採用` などでレシピ候補も選べます。',
    ],
    notes: [
      '信頼度が低い食材は `要確認` と表示されます。',
      '在庫保存前に内容を直せるので、そのまま自動保存はされません。',
    ],
  },
  kitchen_advice: {
    channelName: 'kitchen-advice',
    displayName: '料理相談',
    commandName: '/ask-cooking',
    example: '/ask-cooking question:鶏むね肉を柔らかくしたい servings:3',
    summary: '料理のコツ、段取り、代替材料などを会話形式で相談できます。',
    steps: [
      'このチャンネルで `/ask-cooking` を候補から選び、質問と人数を入れて送信します。',
      'Bot が専用スレッドを作り、最初の回答を出します。',
      '`もっと詳しく` `時短寄りに` `子ども向けに` `代替材料を聞く` で会話を続けます。',
      '`終了` で相談を閉じます。',
    ],
    notes: [
      '質問は短くても大丈夫です。料理名だけでも相談できます。',
      '回答は毎回人数前提付きで扱います。',
    ],
  },
}

function buildOverviewEmbed(guildName: string) {
  return new EmbedBuilder()
    .setTitle(`${guildName} の使い方`)
    .setDescription([
      'Kitchen Assistant の総合ヘルプです。まずは使いたいチャンネルへ移動して、入力欄で `/` を押してコマンド候補を選んでください。',
      '',
      ...Object.values(WORKFLOW_HELP).map((entry) =>
        `**#${entry.channelName}**\n${entry.summary}\nコマンド: \`${entry.commandName}\`\n例: \`${entry.example}\``,
      ),
      '',
      '困ったときは `/help` を使うか、このチャンネルの案内を見返してください。',
    ].join('\n'))
    .setFooter({ text: `${HELP_FOOTER_PREFIX}:overview` })
}

function buildWorkflowEmbed(workflow: DiscordWorkflow, compact = false) {
  const entry = WORKFLOW_HELP[workflow]
  const title = compact ? `#${entry.channelName} の使い方` : `${entry.displayName} の使い方`

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription([
      entry.summary,
      '',
      `**使うコマンド**: \`${entry.commandName}\``,
      `**入力例**: \`${entry.example}\``,
      '',
      '**手順**',
      ...entry.steps.map((step, index) => `${index + 1}. ${step}`),
      '',
      '**注意**',
      ...entry.notes.map((note) => `- ${note}`),
    ].join('\n'))
    .setFooter({ text: `${HELP_FOOTER_PREFIX}:${workflow}:${compact ? 'compact' : 'full'}` })
}

function buildHelpEmbed(topic: HelpTopic, guildName: string, compact = false) {
  if (topic === 'overview') {
    return buildOverviewEmbed(guildName)
  }
  return buildWorkflowEmbed(topic, compact)
}

function getHelpChoices() {
  return [
    { name: '総合案内', value: 'overview' },
    ...Object.entries(WORKFLOW_HELP).map(([workflow, entry]) => ({
      name: entry.displayName,
      value: workflow,
    })),
  ]
}

function isGuildTextChannel(channel: GuildBasedChannel | null): channel is GuildTextBasedChannel {
  return Boolean(channel && channel.type === ChannelType.GuildText)
}

async function findExistingHelpMessage(
  channel: GuildTextBasedChannel,
  marker: string,
  botUserId: string,
) {
  const recentMessages = await channel.messages.fetch({ limit: 50 })
  return recentMessages.find((message) =>
    message.author.id === botUserId
    && message.embeds[0]?.footer?.text === marker,
  )
}

async function upsertHelpMessage(
  channel: GuildTextBasedChannel,
  embed: EmbedBuilder,
  botUserId: string,
) {
  const marker = embed.data.footer?.text
  if (!marker) {
    throw new Error('Help embed footer marker is required')
  }

  const existing = await findExistingHelpMessage(channel, marker, botUserId)
  if (existing) {
    await existing.edit({ embeds: [embed] })
    if (!existing.pinned) {
      await existing.pin().catch(() => undefined)
    }
    return existing
  }

  const created = await channel.send({ embeds: [embed] })
  await created.pin().catch(() => undefined)
  return created
}

async function ensureHelpChannel(guild: Guild): Promise<GuildTextBasedChannel> {
  await guild.channels.fetch()
  const existing = guild.channels.cache.find((channel) =>
    channel.type === ChannelType.GuildText && channel.name === HELP_CHANNEL_NAME,
  )
  if (isGuildTextChannel(existing ?? null)) {
    return existing as GuildTextBasedChannel
  }

  const created = await guild.channels.create({
    name: HELP_CHANNEL_NAME,
    type: ChannelType.GuildText,
    topic: 'Kitchen Assistant の全体的な使い方と slash command の案内',
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
    ],
  })

  if (!isGuildTextChannel(created)) {
    throw new Error('how-to-use channel could not be created as a text channel')
  }

  return created
}

export function buildHelpCommand() {
  return new SlashCommandBuilder()
    .setName('help')
    .setDescription('Kitchen Assistant の使い方を表示します')
    .addStringOption((option) =>
      option
        .setName('topic')
        .setDescription('見たい説明')
        .setRequired(false)
        .addChoices(...getHelpChoices()),
    )
}

export function buildSyncHelpCommand() {
  return new SlashCommandBuilder()
    .setName('sync-help')
    .setDescription('ヘルプチャンネルと案内メッセージを作成・更新します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
}

export async function handleHelpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Guild 内でのみ使えます。', ephemeral: true })
    return
  }

  const topicRaw = interaction.options.getString('topic')
  const topic = (topicRaw ?? 'overview') as HelpTopic
  const embed = buildHelpEmbed(topic, interaction.guild.name)
  await interaction.reply({ embeds: [embed], ephemeral: true })
}

export async function syncHelpResources(client: Client, guildId: string): Promise<{ helpChannelId: string }> {
  const guild = await client.guilds.fetch(guildId)
  const fullGuild = await guild.fetch()
  const botUserId = client.user?.id
  if (!botUserId) {
    throw new Error('Bot user is not ready')
  }

  const helpChannel = await ensureHelpChannel(fullGuild)
  await upsertHelpMessage(helpChannel, buildOverviewEmbed(fullGuild.name), botUserId)
  for (const workflow of Object.keys(WORKFLOW_HELP) as DiscordWorkflow[]) {
    await upsertHelpMessage(helpChannel, buildWorkflowEmbed(workflow), botUserId)
  }

  for (const workflow of Object.keys(WORKFLOW_HELP) as DiscordWorkflow[]) {
    const boundChannelId = await getWorkflowChannel({ guildId, workflow })
    if (!boundChannelId) continue
    const boundChannel = await fullGuild.channels.fetch(boundChannelId)
    if (!isGuildTextChannel(boundChannel)) continue
    await upsertHelpMessage(boundChannel, buildWorkflowEmbed(workflow, true), botUserId)
  }

  return { helpChannelId: helpChannel.id }
}

export async function handleSyncHelpCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: 'Guild 内でのみ使えます。', ephemeral: true })
    return
  }

  await interaction.deferReply({ ephemeral: true })
  const result = await syncHelpResources(interaction.client, interaction.guildId)
  await interaction.editReply(`ヘルプを同期しました。総合案内チャンネル: <#${result.helpChannelId}>`)
}

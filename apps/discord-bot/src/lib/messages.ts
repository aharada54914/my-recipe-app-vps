import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js'
import type {
  KitchenAdviceSessionSummary,
  PhotoAnalysisDraftSummary,
  RecipeImportDraftSummary,
  RecipeImportReviewField,
  WeeklyMenuProposalSummary,
} from '@kitchen/shared-types'

function formatReviewFields(fields: RecipeImportReviewField[]): string {
  if (fields.length === 0) return 'なし'

  const labels: Record<RecipeImportReviewField, string> = {
    title: 'レシピ名',
    device: '調理デバイス',
    category: 'カテゴリ',
    baseServings: '基準人数',
    totalTimeMinutes: '所要時間',
    nutritionPerServing: '栄養情報',
  }

  return fields.map((field) => labels[field]).join('、')
}

export function buildRecipeImportDraftMessage(
  draft: RecipeImportDraftSummary,
){
  const embed = new EmbedBuilder()
    .setTitle(`URL取込下書き #${draft.id}`)
    .setDescription([
      `**レシピ名**: ${draft.title}`,
      `**想定人数**: 今回 ${draft.requestedServings} 人分 / 元レシピ ${draft.baseServings} 人分`,
      `**デバイス**: ${draft.device}`,
      `**カテゴリ**: ${draft.category}`,
      `**所要時間**: ${draft.totalTimeMinutes} 分`,
      `**材料数**: ${draft.ingredientCount} 件`,
      `**手順数**: ${draft.stepCount} 件`,
      `**確認項目**: ${formatReviewFields(draft.reviewFields)}`,
      `**状態**: ${draft.status}`,
      `**元URL**: ${draft.sourceUrl}`,
    ].join('\n'))

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`recipe-import:edit:${draft.id}`)
      .setLabel('基本情報を編集')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`recipe-import:refresh:${draft.id}`)
      .setLabel('再読込')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`recipe-import:approve:${draft.id}`)
      .setLabel('登録OK')
      .setStyle(ButtonStyle.Success)
      .setDisabled(draft.status === 'persisted' || draft.reviewFields.length > 0),
    new ButtonBuilder()
      .setCustomId(`recipe-import:cancel:${draft.id}`)
      .setLabel('キャンセル')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(draft.status === 'persisted' || draft.status === 'cancelled'),
  )

  return {
    embeds: [embed],
    components: [buttons],
  }
}

export function buildWeeklyMenuProposalMessage(proposal: WeeklyMenuProposalSummary) {
  const embed = new EmbedBuilder()
    .setTitle(`週間献立案 #${proposal.id}`)
    .setDescription([
      `**対象週**: ${proposal.weekStartDate}`,
      `**人数**: ${proposal.requestedServings}人分`,
      `**状態**: ${proposal.status}`,
      ...(proposal.notes ? [`**メモ**: ${proposal.notes}`] : []),
      '',
      ...proposal.items.map((item, index) =>
        `**${index + 1}日目 ${item.date}** ${item.recipeTitle} / ${item.category} / ${item.device} / 今回${item.servings}人分 (元${item.baseServings}人分) / 天気:${item.weatherText} ${item.maxTempC}℃ 雨${item.precipitationMm}mm`,
      ),
    ].join('\n'))

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`weekly-menu:replace:${proposal.id}`)
      .setLabel('気に入らない日を差し替え')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(proposal.status === 'persisted' || proposal.status === 'cancelled'),
    new ButtonBuilder()
      .setCustomId(`weekly-menu:refresh:${proposal.id}`)
      .setLabel('再読込')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`weekly-menu:approve:${proposal.id}`)
      .setLabel('この献立で保存')
      .setStyle(ButtonStyle.Success)
      .setDisabled(proposal.status === 'persisted' || proposal.status === 'cancelled'),
    new ButtonBuilder()
      .setCustomId(`weekly-menu:cancel:${proposal.id}`)
      .setLabel('キャンセル')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(proposal.status === 'persisted' || proposal.status === 'cancelled'),
  )

  return {
    embeds: [embed],
    components: [actionRow],
  }
}

export function buildPhotoAnalysisMessage(draft: PhotoAnalysisDraftSummary) {
  const embed = new EmbedBuilder()
    .setTitle(`写真解析案 #${draft.id}`)
    .setDescription([
      `**人数**: ${draft.requestedServings}人分`,
      `**状態**: ${draft.status}`,
      `**抽出食材**: ${draft.detectedIngredients.join('、') || 'なし'}`,
      '',
      ...draft.candidates.map((candidate, index) =>
        `**候補${index + 1}** ${candidate.title} / ${candidate.category} / ${candidate.device} / 今回${candidate.requestedServings}人分 (元${candidate.baseServings}人分)\n一致: ${candidate.matchedIngredients.join('、')}${candidate.missingIngredients.length > 0 ? `\n不足: ${candidate.missingIngredients.slice(0, 5).join('、')}` : ''}`,
      ),
    ].join('\n'))
    .setImage(draft.imageUrl)

  const primaryRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`stock-photo:pick1:${draft.id}`)
      .setLabel('候補1を採用')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!draft.candidates[0] || draft.status === 'approved' || draft.status === 'cancelled'),
    new ButtonBuilder()
      .setCustomId(`stock-photo:pick2:${draft.id}`)
      .setLabel('候補2を採用')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!draft.candidates[1] || draft.status === 'approved' || draft.status === 'cancelled'),
    new ButtonBuilder()
      .setCustomId(`stock-photo:pick3:${draft.id}`)
      .setLabel('候補3を採用')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!draft.candidates[2] || draft.status === 'approved' || draft.status === 'cancelled'),
  )

  const secondaryRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`stock-photo:edit:${draft.id}`)
      .setLabel('食材を編集')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(draft.status === 'approved' || draft.status === 'cancelled'),
    new ButtonBuilder()
      .setCustomId(`stock-photo:refresh:${draft.id}`)
      .setLabel('別候補を出す')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(draft.status === 'approved' || draft.status === 'cancelled'),
    new ButtonBuilder()
      .setCustomId(`stock-photo:cancel:${draft.id}`)
      .setLabel('キャンセル')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(draft.status === 'approved' || draft.status === 'cancelled'),
  )

  return {
    embeds: [embed],
    components: [primaryRow, secondaryRow],
  }
}

export function buildKitchenAdviceMessage(session: KitchenAdviceSessionSummary) {
  const embed = new EmbedBuilder()
    .setTitle(`料理相談 #${session.id}`)
    .setDescription([
      `**人数**: ${session.requestedServings}人分`,
      `**状態**: ${session.status}`,
      '',
      session.latestResponse,
    ].join('\n'))

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`kitchen-advice:detail:${session.id}`)
      .setLabel('もっと詳しく')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(session.status !== 'active'),
    new ButtonBuilder()
      .setCustomId(`kitchen-advice:quick:${session.id}`)
      .setLabel('時短寄りに')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(session.status !== 'active'),
    new ButtonBuilder()
      .setCustomId(`kitchen-advice:kids:${session.id}`)
      .setLabel('子ども向けに')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(session.status !== 'active'),
    new ButtonBuilder()
      .setCustomId(`kitchen-advice:swap:${session.id}`)
      .setLabel('代替材料を聞く')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(session.status !== 'active'),
    new ButtonBuilder()
      .setCustomId(`kitchen-advice:close:${session.id}`)
      .setLabel('終了')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(session.status !== 'active'),
  )

  return {
    embeds: [embed],
    components: [row],
  }
}

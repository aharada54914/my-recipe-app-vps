import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js'
import type { RecipeImportDraftSummary, RecipeImportReviewField } from '@kitchen/shared-types'

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

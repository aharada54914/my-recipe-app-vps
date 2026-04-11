import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js'
import type {
  DiscordStockExpiryAlertBatch,
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
  const presetLabel = proposal.preset === 'washoku_focus'
    ? '和食多め'
    : proposal.preset === 'budget_saver'
      ? '節約重視'
      : proposal.preset === 'fish_more'
        ? '魚多め'
        : undefined
  const planStartDate = proposal.items[0]?.date ?? proposal.weekStartDate
  const planEndDate = proposal.items[proposal.items.length - 1]?.date ?? proposal.weekStartDate
  const targetPeriodLabel = planStartDate === planEndDate
    ? planStartDate
    : `${planStartDate} - ${planEndDate}`
  const proposalTitle = proposal.planningMode === 'day'
    ? `当日メニュー案 #${proposal.id}`
    : `週間献立案 #${proposal.id}`
  const calendarSyncLines = proposal.calendarSync
    ? [
      '',
      `**家族カレンダー登録**: ${proposal.calendarSync.status === 'registered' ? '成功' : proposal.calendarSync.status === 'failed' ? '失敗' : '未実行'}`,
      ...(proposal.calendarSync.calendarId ? [`登録先: ${proposal.calendarSync.calendarId}`] : []),
      ...(proposal.calendarSync.registeredCount != null ? [`登録件数: ${proposal.calendarSync.registeredCount}件`] : []),
      ...(proposal.calendarSync.errors && proposal.calendarSync.errors.length > 0
        ? [`詳細: ${proposal.calendarSync.errors.slice(0, 3).join(' / ')}`]
        : []),
    ]
    : []

  const embed = new EmbedBuilder()
    .setTitle(proposalTitle)
    .setDescription([
      `**対象期間**: ${targetPeriodLabel}`,
      `**人数**: ${proposal.requestedServings}人分`,
      `**状態**: ${proposal.status}`,
      ...(presetLabel ? [`**テンプレ条件**: ${presetLabel}`] : []),
      ...(proposal.notes ? [`**メモ**: ${proposal.notes}`] : []),
      ...(proposal.excludedRecipeIds.length > 0
        ? [`**今週は除外**: ${proposal.excludedRecipeIds.length}件`]
        : []),
      '',
      ...proposal.items.map((item, index) =>
        [
          `**${index + 1}日目 ${item.date}** 主菜: ${item.recipeTitle} / ${item.category} / ${item.device}`,
          item.sideRecipeTitle ? `副菜: ${item.sideRecipeTitle} / ${item.sideCategory} / ${item.sideDevice}` : '副菜: なし',
          `人数: 今回${item.servings}人分 (元${item.baseServings}人分) / 天気:${item.weatherText} ${item.maxTempC}℃ 雨${item.precipitationMm}mm`,
          item.scoreSummary ? `選定理由: ${item.scoreSummary}` : '',
          item.mainCandidates[item.currentMainCandidateIndex + 1]
            ? `次点主菜: ${item.mainCandidates[item.currentMainCandidateIndex + 1]?.title}`
            : '次点主菜: なし',
          item.sideCandidates?.[item.currentSideCandidateIndex != null ? item.currentSideCandidateIndex + 1 : 0]
            ? `次点副菜: ${item.sideCandidates[item.currentSideCandidateIndex != null ? item.currentSideCandidateIndex + 1 : 0]?.title}`
            : '次点副菜: なし',
          item.excludedRecipeIds.length > 0 ? `この日で除外中: ${item.excludedRecipeIds.length}件` : '',
        ].filter(Boolean).join('\n'),
      ),
      ...calendarSyncLines,
    ].join('\n'))

  const replaceRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`weekly-menu:next:${proposal.id}`)
      .setLabel('次点候補へ')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(proposal.status === 'persisted' || proposal.status === 'cancelled'),
    new ButtonBuilder()
      .setCustomId(`weekly-menu:blacklist:${proposal.id}`)
      .setLabel('今週はもう出さない')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(proposal.status === 'persisted' || proposal.status === 'cancelled'),
    new ButtonBuilder()
      .setCustomId(`weekly-menu:refresh:${proposal.id}`)
      .setLabel('在庫優先で再探索')
      .setStyle(ButtonStyle.Secondary),
  )

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`weekly-menu:approve:${proposal.id}`)
      .setLabel('保存して家族カレンダーへ登録')
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
    components: [replaceRow, actionRow],
  }
}

export function buildPhotoAnalysisMessage(draft: PhotoAnalysisDraftSummary) {
  const embed = new EmbedBuilder()
    .setTitle(`写真解析案 #${draft.id}`)
    .setDescription([
      `**人数**: ${draft.requestedServings}人分`,
      `**状態**: ${draft.status}`,
      `**抽出食材**: ${draft.detectedIngredients.length > 0 ? '' : 'なし'}`,
      ...draft.detectedIngredients.map((ingredient) =>
        `- ${ingredient.name} (${Math.round(ingredient.confidence * 100)}%)${ingredient.isUncertain ? ' 要確認' : ''}${ingredient.visionHint ? ` / ${ingredient.visionHint}` : ''}${ingredient.matchedStockName ? ` / 既存在庫:${ingredient.matchedStockName}` : ''}${ingredient.suggestedStockAction ? ` / 提案:${ingredient.suggestedStockAction === 'merge' ? '既存在庫へ加算' : '新規追加'}` : ''}`,
      ),
      '',
      ...draft.candidates.map((candidate, index) =>
        `**候補${index + 1}** ${candidate.title} / ${candidate.category} / ${candidate.device} / 今回${candidate.requestedServings}人分 (元${candidate.baseServings}人分)\n一致: ${candidate.matchedIngredients.join('、')}${candidate.missingIngredients.length > 0 ? `\n不足: ${candidate.missingIngredients.slice(0, 5).join('、')}` : ''}`,
      ),
      ...(draft.stockSaveSummary
        ? ['', `**在庫保存**: ${draft.stockSaveSummary.savedCount}件`, `保存対象: ${draft.stockSaveSummary.names.join('、')}`]
        : []),
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
      .setCustomId(`stock-photo:save-stock:${draft.id}`)
      .setLabel('在庫に保存')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(draft.status === 'cancelled'),
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

export function buildStockExpiryAlertMessage(batch: DiscordStockExpiryAlertBatch) {
  const embed = new EmbedBuilder()
    .setTitle('在庫の期限アラート')
    .setDescription(
      batch.items.length === 0
        ? '期限が近い在庫はありません。'
        : batch.items
          .slice(0, 20)
          .map((item) => {
            const status = item.daysUntilExpiry < 0
              ? `${Math.abs(item.daysUntilExpiry)}日前に期限切れ`
              : item.daysUntilExpiry === 0
                ? '今日まで'
                : `あと${item.daysUntilExpiry}日`
            return `- **${item.stockName}** (${item.userLabel}) / ${status} / 期限: ${item.expiresAt.toISOString().slice(0, 10)}`
          })
          .join('\n'),
    )

  return { embeds: [embed] }
}

import type { InputJsonValue } from '@prisma/client/runtime/library'
import { prisma } from '../../db/client.js'
import {
  type CreateDiscordRecipeImportDraftRequest,
  type RecipeImportDraftSummary,
  type RecipeImportReviewField,
  type UpdateDiscordRecipeImportDraftRequest,
} from '@kitchen/shared-types'
import { extractRecipeSourceFromUrl } from './extract.js'
import { parseRecipeFromExtractedSource } from './parser.js'

type RecipeImportPrisma = {
  conversationTurn: {
    create: (args: unknown) => Promise<unknown>
  }
  discordGuildConfig: {
    upsert: (args: unknown) => Promise<unknown>
    findUnique: (args: unknown) => Promise<{
      recipeImportChannelId: string | null
      weeklyMenuChannelId: string | null
      stockPhotoChannelId: string | null
      kitchenAdviceChannelId: string | null
    } | null>
  }
  conversationSession: {
    create: (args: unknown) => Promise<{ id: number }>
  }
  recipeImportDraft: {
    create: (args: unknown) => Promise<{
      id: number
      sessionId: number
      status: string
      sourceUrl: string
      requestedServings: number
      extractedRecipe: unknown
      reviewFields: unknown
      createdRecipeId: number | null
      session: { threadId: string | null }
    }>
    findUnique: (args: unknown) => Promise<{
      id: number
      sessionId: number
      status: string
      sourceUrl: string
      requestedServings: number
      extractedRecipe: unknown
      reviewFields: unknown
      createdRecipeId: number | null
      session: { threadId: string | null; status?: string; discordUserId?: string }
    } | null>
    update: (args: unknown) => Promise<{
      id: number
      sessionId: number
      status: string
      sourceUrl: string
      requestedServings: number
      extractedRecipe: unknown
      reviewFields: unknown
      createdRecipeId: number | null
      session: { threadId: string | null }
    }>
  }
  recipe: typeof prisma.recipe
}

const prismaModels = prisma as unknown as RecipeImportPrisma

function toJsonValue<T>(value: T): InputJsonValue {
  return value as InputJsonValue
}

function summarizeDraft(record: {
  id: number
  sessionId: number
  status: string
  sourceUrl: string
  requestedServings: number
  extractedRecipe: unknown
  reviewFields: unknown
  createdRecipeId: number | null
  session: { threadId: string | null }
}): RecipeImportDraftSummary {
  const recipe = record.extractedRecipe as {
    title: string
    baseServings: number
    device: 'hotcook' | 'healsio' | 'manual'
    category: '主菜' | '副菜' | 'スープ' | '一品料理' | 'スイーツ'
    totalTimeMinutes: number
    ingredients: unknown[]
    steps: unknown[]
  }

  return {
    id: record.id,
    sessionId: record.sessionId,
    ...(record.session.threadId ? { threadId: record.session.threadId } : {}),
    status: record.status as RecipeImportDraftSummary['status'],
    sourceUrl: record.sourceUrl,
    requestedServings: record.requestedServings,
    title: recipe.title,
    baseServings: recipe.baseServings,
    device: recipe.device,
    category: recipe.category,
    totalTimeMinutes: recipe.totalTimeMinutes,
    ingredientCount: Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0,
    stepCount: Array.isArray(recipe.steps) ? recipe.steps.length : 0,
    reviewFields: Array.isArray(record.reviewFields)
      ? (record.reviewFields as RecipeImportReviewField[])
      : [],
    ...(record.createdRecipeId ? { createdRecipeId: record.createdRecipeId } : {}),
  }
}

async function appendConversationTurn(params: {
  sessionId: number
  actorType: 'system' | 'discord_user'
  actorId: string
  eventType: string
  payload: Record<string, unknown>
}): Promise<void> {
  await prismaModels.conversationTurn.create({
    data: {
      sessionId: params.sessionId,
      actorType: params.actorType,
      actorId: params.actorId,
      eventType: params.eventType,
      payload: toJsonValue(params.payload),
    },
  })
}

export async function bindDiscordWorkflowChannel(input: {
  guildId: string
  workflow: 'recipe_import' | 'weekly_menu' | 'stock_photo' | 'kitchen_advice'
  channelId: string
}): Promise<void> {
  const updateField =
    input.workflow === 'recipe_import'
      ? { recipeImportChannelId: input.channelId }
      : input.workflow === 'weekly_menu'
        ? { weeklyMenuChannelId: input.channelId }
        : input.workflow === 'stock_photo'
          ? { stockPhotoChannelId: input.channelId }
          : { kitchenAdviceChannelId: input.channelId }

  await prismaModels.discordGuildConfig.upsert({
    where: { guildId: input.guildId },
    update: updateField,
    create: {
      guildId: input.guildId,
      ...updateField,
    },
  })
}

export async function getDiscordWorkflowChannel(input: {
  guildId: string
  workflow: 'recipe_import' | 'weekly_menu' | 'stock_photo' | 'kitchen_advice'
}): Promise<string | null> {
  const config = await prismaModels.discordGuildConfig.findUnique({
    where: { guildId: input.guildId },
  })
  if (!config) return null

  if (input.workflow === 'recipe_import') return config.recipeImportChannelId
  if (input.workflow === 'weekly_menu') return config.weeklyMenuChannelId
  if (input.workflow === 'stock_photo') return config.stockPhotoChannelId
  return config.kitchenAdviceChannelId
}

export async function createRecipeImportDraft(
  input: CreateDiscordRecipeImportDraftRequest,
): Promise<RecipeImportDraftSummary> {
  const extracted = await extractRecipeSourceFromUrl(input.url)
  const parsed = await parseRecipeFromExtractedSource(extracted)

  const session = await prismaModels.conversationSession.create({
    data: {
      workflow: 'recipe_import',
      status: 'awaiting_user',
      guildId: input.guildId,
      channelId: input.channelId,
      threadId: input.threadId,
      discordUserId: input.discordUserId,
      requestedServings: input.requestedServings,
      metadata: toJsonValue({
        sourceUrl: extracted.url,
        fetchStrategy: extracted.fetchStrategy,
        warnings: extracted.warnings,
      }),
    },
  })

  const draft = await prismaModels.recipeImportDraft.create({
    data: {
      sessionId: session.id,
      sourceUrl: extracted.url,
      requestedServings: input.requestedServings,
      extractedRecipe: toJsonValue(parsed.recipe),
      reviewFields: toJsonValue(parsed.reviewFields),
      status: parsed.reviewFields.length > 0 ? 'needs_review' : 'draft',
    },
    include: {
      session: {
        select: { threadId: true },
      },
    },
  })

  await appendConversationTurn({
    sessionId: session.id,
    actorType: 'discord_user',
    actorId: input.discordUserId,
    eventType: 'recipe_import_created',
    payload: {
      sourceUrl: extracted.url,
      requestedServings: input.requestedServings,
      reviewFields: parsed.reviewFields,
    },
  })

  return summarizeDraft(draft)
}

export async function getRecipeImportDraftById(id: number): Promise<RecipeImportDraftSummary | null> {
  const draft = await prismaModels.recipeImportDraft.findUnique({
    where: { id },
    include: {
      session: {
        select: { threadId: true },
      },
    },
  })

  return draft ? summarizeDraft(draft) : null
}

export async function updateRecipeImportDraft(
  id: number,
  input: UpdateDiscordRecipeImportDraftRequest,
  actorDiscordUserId: string,
): Promise<RecipeImportDraftSummary> {
  const existing = await prismaModels.recipeImportDraft.findUnique({
    where: { id },
    include: {
      session: true,
    },
  })

  if (!existing) {
    throw new Error('下書きが見つかりません。')
  }

  if (existing.session.discordUserId && existing.session.discordUserId !== actorDiscordUserId) {
    throw new Error('この下書きを編集できるのは作成したユーザーのみです。')
  }

  const recipe = { ...(existing.extractedRecipe as Record<string, unknown>) }
  if (input.title !== undefined) recipe.title = input.title
  if (input.device !== undefined) recipe.device = input.device
  if (input.category !== undefined) recipe.category = input.category
  if (input.baseServings !== undefined) recipe.baseServings = input.baseServings
  if (input.totalTimeMinutes !== undefined) recipe.totalTimeMinutes = input.totalTimeMinutes

  const previousReviewFields = Array.isArray(existing.reviewFields)
    ? [...(existing.reviewFields as RecipeImportReviewField[])]
    : []

  const updatedReviewFields = previousReviewFields.filter((field) => {
    if (field === 'title' && input.title !== undefined) return false
    if (field === 'device' && input.device !== undefined) return false
    if (field === 'category' && input.category !== undefined) return false
    if (field === 'baseServings' && input.baseServings !== undefined) return false
    if (field === 'totalTimeMinutes' && input.totalTimeMinutes !== undefined) return false
    return true
  })

  const draft = await prismaModels.recipeImportDraft.update({
    where: { id },
    data: {
      extractedRecipe: toJsonValue(recipe),
      reviewFields: toJsonValue(updatedReviewFields),
      status: updatedReviewFields.length > 0 ? 'needs_review' : 'draft',
    },
    include: {
      session: {
        select: { threadId: true },
      },
    },
  })

  await appendConversationTurn({
    sessionId: existing.sessionId,
    actorType: 'discord_user',
    actorId: actorDiscordUserId,
    eventType: 'recipe_import_updated',
    payload: input as Record<string, unknown>,
  })

  return summarizeDraft(draft)
}

export async function approveRecipeImportDraft(
  id: number,
  actorDiscordUserId: string,
): Promise<RecipeImportDraftSummary> {
  const existing = await prismaModels.recipeImportDraft.findUnique({
    where: { id },
    include: {
      session: true,
    },
  })

  if (!existing) {
    throw new Error('下書きが見つかりません。')
  }

  if (existing.session.discordUserId && existing.session.discordUserId !== actorDiscordUserId) {
    throw new Error('この下書きを承認できるのは作成したユーザーのみです。')
  }

  if (existing.createdRecipeId) {
    const current = await prismaModels.recipeImportDraft.findUnique({
      where: { id },
      include: {
        session: {
          select: { threadId: true },
        },
      },
    })
    if (!current) throw new Error('下書きが見つかりません。')
    return summarizeDraft(current)
  }

  const recipe = existing.extractedRecipe as {
    title: string
    recipeNumber: string
    device: 'hotcook' | 'healsio' | 'manual'
    category: '主菜' | '副菜' | 'スープ' | '一品料理' | 'スイーツ'
    baseServings: number
    totalWeightG: number
    totalTimeMinutes: number
    ingredients: unknown[]
    steps: unknown[]
    nutritionPerServing?: unknown
    imageUrl?: string
    sourceUrl?: string
    isUserAdded?: boolean
  }

  if (Array.isArray(existing.reviewFields) && existing.reviewFields.length > 0) {
    throw new Error('確認待ちの項目があります。編集してから承認してください。')
  }

  const duplicate = await prisma.recipe.findFirst({
    where: {
      OR: [
        { title: recipe.title },
        ...(recipe.sourceUrl ? [{ sourceUrl: recipe.sourceUrl }] : []),
      ],
    },
    select: { id: true, title: true },
  })

  if (duplicate) {
    throw new Error(`既存レシピと重複しています: ${duplicate.title}`)
  }

  const createdRecipe = await prisma.recipe.create({
    data: {
      title: recipe.title,
      recipeNumber: recipe.recipeNumber,
      device: recipe.device,
      category: recipe.category,
      baseServings: recipe.baseServings,
      totalWeightG: recipe.totalWeightG,
      totalTimeMinutes: recipe.totalTimeMinutes,
      ingredients: toJsonValue(recipe.ingredients),
      steps: toJsonValue(recipe.steps),
      nutritionPerServing: recipe.nutritionPerServing
        ? toJsonValue(recipe.nutritionPerServing)
        : undefined,
      imageUrl: recipe.imageUrl,
      sourceUrl: recipe.sourceUrl,
      isUserAdded: true,
    },
  })

  const draft = await prismaModels.recipeImportDraft.update({
    where: { id },
    data: {
      status: 'persisted',
      createdRecipeId: createdRecipe.id,
      session: {
        update: {
          status: 'completed',
          approvedAt: new Date(),
        },
      },
    },
    include: {
      session: {
        select: { threadId: true },
      },
    },
  })

  await appendConversationTurn({
    sessionId: existing.sessionId,
    actorType: 'discord_user',
    actorId: actorDiscordUserId,
    eventType: 'recipe_import_approved',
    payload: {
      draftId: id,
      createdRecipeId: createdRecipe.id,
    },
  })

  return summarizeDraft(draft)
}

export async function cancelRecipeImportDraft(
  id: number,
  actorDiscordUserId: string,
): Promise<RecipeImportDraftSummary> {
  const existing = await prismaModels.recipeImportDraft.findUnique({
    where: { id },
  })

  if (!existing) {
    throw new Error('下書きが見つかりません。')
  }

  if (existing.session.discordUserId && existing.session.discordUserId !== actorDiscordUserId) {
    throw new Error('この下書きをキャンセルできるのは作成したユーザーのみです。')
  }

  const draft = await prismaModels.recipeImportDraft.update({
    where: { id },
    data: {
      status: 'cancelled',
      session: {
        update: {
          status: 'cancelled',
        },
      },
    },
    include: {
      session: {
        select: { threadId: true },
      },
    },
  })

  await appendConversationTurn({
    sessionId: existing.sessionId,
    actorType: 'discord_user',
    actorId: actorDiscordUserId,
    eventType: 'recipe_import_cancelled',
    payload: { draftId: id },
  })

  return summarizeDraft(draft)
}

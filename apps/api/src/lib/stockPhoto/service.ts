import type { InputJsonValue } from '@prisma/client/runtime/library'
import type {
  PhotoAnalysisDraftSummary,
  PhotoRecipeCandidate,
  UpdateDiscordPhotoAnalysisRequest,
} from '@kitchen/shared-types'
import { prisma } from '../../db/client.js'
import { ensureDiscordAppUser } from '../discord/userLink.js'
import { buildPhotoRecipeCandidates, type RecipeRecordLite } from '../discord/recipeMatchers.js'
import { extractJsonObjectText, generateGeminiTextFromImageAndPrompt } from '../gemini.js'

const INGREDIENT_EXTRACTION_PROMPT = `あなたは冷蔵庫食材の抽出アシスタントです。
画像に写っている食材を日本語で抽出し、JSONのみで返してください。

出力形式:
{
  "ingredients": ["鶏もも肉", "玉ねぎ", "にんじん"]
}

ルール:
- 調味料は出力しない
- 重複は除外
- 不確実な食材は含めない
- 食材名のみを返す
- JSON以外の説明文を出さない`

function toJsonValue<T>(value: T): InputJsonValue {
  return value as InputJsonValue
}

async function appendConversationTurn(params: {
  sessionId: number
  actorType: 'system' | 'discord_user'
  actorId: string
  eventType: string
  payload: Record<string, unknown>
}): Promise<void> {
  await prisma.conversationTurn.create({
    data: {
      sessionId: params.sessionId,
      actorType: params.actorType,
      actorId: params.actorId,
      eventType: params.eventType,
      payload: toJsonValue(params.payload),
    },
  })
}

function normalizePhotoDraft(record: {
  id: number
  sessionId: number
  status: string
  imageUrl: string
  requestedServings: number
  detectedIngredients: unknown
  candidateRecipes: unknown
  selectedRecipeId: number | null
  session: { threadId: string | null }
}): PhotoAnalysisDraftSummary {
  return {
    id: record.id,
    sessionId: record.sessionId,
    ...(record.session.threadId ? { threadId: record.session.threadId } : {}),
    status: record.status as PhotoAnalysisDraftSummary['status'],
    imageUrl: record.imageUrl,
    requestedServings: record.requestedServings,
    detectedIngredients: Array.isArray(record.detectedIngredients)
      ? (record.detectedIngredients as string[])
      : [],
    candidates: Array.isArray(record.candidateRecipes)
      ? (record.candidateRecipes as PhotoRecipeCandidate[])
      : [],
    ...(record.selectedRecipeId ? { selectedRecipeId: record.selectedRecipeId } : {}),
  }
}

async function fetchImageAsInlineData(imageUrl: string): Promise<{
  mimeType: string
  data: string
}> {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error(`画像の取得に失敗しました (${response.status})`)
  }
  const arrayBuffer = await response.arrayBuffer()
  const mimeType = response.headers.get('content-type') ?? 'image/jpeg'
  return {
    mimeType,
    data: Buffer.from(arrayBuffer).toString('base64'),
  }
}

async function extractIngredientsFromImageUrl(imageUrl: string): Promise<string[]> {
  const image = await fetchImageAsInlineData(imageUrl)
  const text = await generateGeminiTextFromImageAndPrompt(INGREDIENT_EXTRACTION_PROMPT, image)
  const json = extractJsonObjectText(text)
  const parsed = JSON.parse(json) as { ingredients?: unknown }
  const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : []
  return Array.from(new Set(
    ingredients
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((name) => name.trim()),
  ))
}

async function loadRecipeCandidates(): Promise<RecipeRecordLite[]> {
  return prisma.recipe.findMany({
    select: {
      id: true,
      title: true,
      device: true,
      category: true,
      baseServings: true,
      ingredients: true,
    },
    take: 400,
  })
}

async function buildCandidates(params: {
  userId: string
  requestedServings: number
  ingredients: string[]
  excludeRecipeIds?: number[]
}): Promise<PhotoRecipeCandidate[]> {
  const [recipes, stocks] = await Promise.all([
    loadRecipeCandidates(),
    prisma.stock.findMany({
      where: { userId: params.userId, inStock: true },
      select: { name: true },
    }),
  ])

  const availableIngredients = Array.from(new Set([
    ...params.ingredients,
    ...stocks.map((item) => item.name),
  ]))

  return buildPhotoRecipeCandidates({
    recipes,
    requestedServings: params.requestedServings,
    availableIngredients,
    excludeRecipeIds: params.excludeRecipeIds,
  })
}

export async function createPhotoAnalysisDraft(input: {
  guildId: string
  channelId: string
  threadId?: string
  discordUserId: string
  requestedServings: number
  imageUrl: string
}): Promise<PhotoAnalysisDraftSummary> {
  const { userId } = await ensureDiscordAppUser({
    discordUserId: input.discordUserId,
    guildId: input.guildId,
  })

  const detectedIngredients = await extractIngredientsFromImageUrl(input.imageUrl)
  const candidates = await buildCandidates({
    userId,
    requestedServings: input.requestedServings,
    ingredients: detectedIngredients,
  })

  const session = await prisma.conversationSession.create({
    data: {
      workflow: 'stock_photo',
      status: 'awaiting_user',
      guildId: input.guildId,
      channelId: input.channelId,
      threadId: input.threadId,
      discordUserId: input.discordUserId,
      requestedServings: input.requestedServings,
    },
  })

  const draft = await prisma.photoAnalysisDraft.create({
    data: {
      sessionId: session.id,
      userId,
      requestedServings: input.requestedServings,
      imageUrl: input.imageUrl,
      detectedIngredients: toJsonValue(detectedIngredients),
      candidateRecipes: toJsonValue(candidates),
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
    eventType: 'photo_analysis_created',
    payload: {
      requestedServings: input.requestedServings,
      detectedIngredients,
    },
  })

  return normalizePhotoDraft(draft)
}

export async function getPhotoAnalysisDraftById(id: number): Promise<PhotoAnalysisDraftSummary | null> {
  const draft = await prisma.photoAnalysisDraft.findUnique({
    where: { id },
    include: {
      session: {
        select: { threadId: true },
      },
    },
  })
  return draft ? normalizePhotoDraft(draft) : null
}

export async function updatePhotoAnalysisDraft(
  id: number,
  input: UpdateDiscordPhotoAnalysisRequest,
): Promise<PhotoAnalysisDraftSummary> {
  const existing = await prisma.photoAnalysisDraft.findUnique({
    where: { id },
    include: { session: true },
  })
  if (!existing) throw new Error('写真解析下書きが見つかりません。')
  if (existing.session.discordUserId !== input.discordUserId) {
    throw new Error('この写真解析を更新できるのは作成したユーザーのみです。')
  }

  const currentIngredients = Array.isArray(existing.detectedIngredients)
    ? (existing.detectedIngredients as string[])
    : []
  const nextIngredients = input.ingredients ?? currentIngredients
  const candidates = await buildCandidates({
    userId: existing.userId,
    requestedServings: existing.requestedServings,
    ingredients: nextIngredients,
    excludeRecipeIds: input.excludeRecipeIds,
  })

  const draft = await prisma.photoAnalysisDraft.update({
    where: { id },
    data: {
      detectedIngredients: toJsonValue(nextIngredients),
      candidateRecipes: toJsonValue(candidates),
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
    actorId: input.discordUserId,
    eventType: 'photo_analysis_updated',
    payload: {
      ingredients: nextIngredients,
      excludeRecipeIds: input.excludeRecipeIds,
    },
  })

  return normalizePhotoDraft(draft)
}

export async function selectPhotoCandidate(id: number, discordUserId: string, recipeId: number): Promise<PhotoAnalysisDraftSummary> {
  const existing = await prisma.photoAnalysisDraft.findUnique({
    where: { id },
    include: { session: true },
  })
  if (!existing) throw new Error('写真解析下書きが見つかりません。')
  if (existing.session.discordUserId !== discordUserId) {
    throw new Error('この写真解析を承認できるのは作成したユーザーのみです。')
  }

  const draft = await prisma.photoAnalysisDraft.update({
    where: { id },
    data: {
      status: 'approved',
      selectedRecipeId: recipeId,
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
    actorId: discordUserId,
    eventType: 'photo_analysis_approved',
    payload: { recipeId },
  })

  return normalizePhotoDraft(draft)
}

export async function cancelPhotoAnalysisDraft(id: number, discordUserId: string): Promise<PhotoAnalysisDraftSummary> {
  const existing = await prisma.photoAnalysisDraft.findUnique({
    where: { id },
    include: { session: true },
  })
  if (!existing) throw new Error('写真解析下書きが見つかりません。')
  if (existing.session.discordUserId !== discordUserId) {
    throw new Error('この写真解析をキャンセルできるのは作成したユーザーのみです。')
  }

  const draft = await prisma.photoAnalysisDraft.update({
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
    actorId: discordUserId,
    eventType: 'photo_analysis_cancelled',
    payload: {},
  })

  return normalizePhotoDraft(draft)
}

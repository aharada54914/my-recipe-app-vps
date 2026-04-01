import type { InputJsonValue } from '@prisma/client/runtime/library'
import type {
  DetectedIngredient,
  PhotoStockSaveItem,
  PhotoAnalysisDraftSummary,
  PhotoRecipeCandidate,
  SaveDiscordPhotoStockRequest,
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
  "ingredients": [
    {
      "name": "鶏もも肉",
      "confidence": 0.96,
      "isUncertain": false,
      "visionHint": "中央のパック肉"
    }
  ]
}

ルール:
- 調味料は出力しない
- 重複は除外
- 不確実な食材も候補として返すが、confidence を下げて isUncertain=true にする
- confidence は 0 から 1 の数値
- 食材名は一般的な日本語名に統一
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
  session: { threadId: string | null; metadata?: unknown }
}): PhotoAnalysisDraftSummary {
  const metadata = typeof record.session.metadata === 'object' && record.session.metadata !== null
    ? record.session.metadata as Record<string, unknown>
    : {}
  const stockSaveSummary =
    typeof metadata.stockSaveSummary === 'object' && metadata.stockSaveSummary != null
      ? metadata.stockSaveSummary as Record<string, unknown>
      : undefined

  return {
    id: record.id,
    sessionId: record.sessionId,
    ...(record.session.threadId ? { threadId: record.session.threadId } : {}),
    status: record.status as PhotoAnalysisDraftSummary['status'],
    imageUrl: record.imageUrl,
    requestedServings: record.requestedServings,
    detectedIngredients: normalizeDetectedIngredients(record.detectedIngredients),
    candidates: Array.isArray(record.candidateRecipes)
      ? (record.candidateRecipes as PhotoRecipeCandidate[])
      : [],
    ...(record.selectedRecipeId ? { selectedRecipeId: record.selectedRecipeId } : {}),
    ...(stockSaveSummary &&
      typeof stockSaveSummary.savedCount === 'number' &&
      Array.isArray(stockSaveSummary.names)
      ? {
        stockSaveSummary: {
          savedCount: stockSaveSummary.savedCount,
          names: stockSaveSummary.names.filter((value): value is string => typeof value === 'string'),
        },
      }
      : {}),
  }
}

function normalizeDetectedIngredients(value: unknown): DetectedIngredient[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (typeof entry === 'string') {
      return [{
        name: entry,
        confidence: 0.85,
        isUncertain: false,
      }]
    }
    if (typeof entry !== 'object' || entry == null || Array.isArray(entry)) return []
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    if (!name) return []
    const confidence = typeof entry.confidence === 'number'
      ? Math.max(0, Math.min(1, entry.confidence))
      : 0.6
    return [{
      name,
      confidence,
      isUncertain: typeof entry.isUncertain === 'boolean' ? entry.isUncertain : confidence < 0.72,
      ...(typeof entry.visionHint === 'string' && entry.visionHint.trim().length > 0
        ? { visionHint: entry.visionHint.trim() }
        : {}),
      ...(typeof entry.matchedStockName === 'string' && entry.matchedStockName.trim().length > 0
        ? { matchedStockName: entry.matchedStockName.trim() }
        : {}),
      ...(entry.suggestedStockAction === 'merge' || entry.suggestedStockAction === 'create'
        ? { suggestedStockAction: entry.suggestedStockAction }
        : {}),
    }]
  })
}

function normalizeStockKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function enrichDetectedIngredientsWithStockMatches(
  ingredients: DetectedIngredient[],
  stockNames: string[],
): DetectedIngredient[] {
  return ingredients.map((ingredient) => {
    const key = normalizeStockKey(ingredient.name)
    const matchedStockName = stockNames.find((stockName) => {
      const stockKey = normalizeStockKey(stockName)
      return stockKey === key || stockKey.includes(key) || key.includes(stockKey)
    })
    return {
      ...ingredient,
      ...(matchedStockName ? {
        matchedStockName,
        suggestedStockAction: 'merge' as const,
      } : {
        suggestedStockAction: 'create' as const,
      }),
    }
  })
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

async function extractIngredientsFromImageUrl(imageUrl: string): Promise<DetectedIngredient[]> {
  const image = await fetchImageAsInlineData(imageUrl)
  const text = await generateGeminiTextFromImageAndPrompt(INGREDIENT_EXTRACTION_PROMPT, image, undefined, 'photo')
  const json = extractJsonObjectText(text)
  const parsed = JSON.parse(json) as { ingredients?: unknown }
  const ingredients = normalizeDetectedIngredients(parsed.ingredients)
  const seen = new Set<string>()
  return ingredients.filter((item) => {
    const key = item.name.trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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
  ingredients: DetectedIngredient[]
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
    ...params.ingredients.map((item) => item.name),
    ...stocks.map((item) => item.name),
  ]))

  return buildPhotoRecipeCandidates({
    recipes,
    requestedServings: params.requestedServings,
    availableIngredients,
    excludeRecipeIds: params.excludeRecipeIds,
  })
}

async function loadUserStockNames(userId: string): Promise<string[]> {
  const stocks = await prisma.stock.findMany({
    where: { userId, inStock: true },
    select: { name: true },
  })
  return stocks.map((item) => item.name)
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

  const stockNames = await loadUserStockNames(userId)
  const detectedIngredients = enrichDetectedIngredientsWithStockMatches(
    await extractIngredientsFromImageUrl(input.imageUrl),
    stockNames,
  )
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
        select: { threadId: true, metadata: true },
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
      detectedIngredients: detectedIngredients.map((item) => item.name),
    },
  })

  return normalizePhotoDraft(draft)
}

export async function getPhotoAnalysisDraftById(id: number): Promise<PhotoAnalysisDraftSummary | null> {
  const draft = await prisma.photoAnalysisDraft.findUnique({
    where: { id },
    include: {
      session: {
        select: { threadId: true, metadata: true },
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

  const currentIngredients = normalizeDetectedIngredients(existing.detectedIngredients)
  const nextIngredients = input.ingredients
    ? input.ingredients.map((name) => ({
      name,
      confidence: 1,
      isUncertain: false,
    }))
    : currentIngredients
  const stockNames = await loadUserStockNames(existing.userId)
  const enrichedIngredients = enrichDetectedIngredientsWithStockMatches(nextIngredients, stockNames)
  const candidates = await buildCandidates({
    userId: existing.userId,
    requestedServings: existing.requestedServings,
    ingredients: enrichedIngredients,
    excludeRecipeIds: input.excludeRecipeIds,
  })

  const draft = await prisma.photoAnalysisDraft.update({
    where: { id },
    data: {
      detectedIngredients: toJsonValue(enrichedIngredients),
      candidateRecipes: toJsonValue(candidates),
    },
    include: {
      session: {
        select: { threadId: true, metadata: true },
      },
    },
  })

  await appendConversationTurn({
    sessionId: existing.sessionId,
    actorType: 'discord_user',
    actorId: input.discordUserId,
    eventType: 'photo_analysis_updated',
    payload: {
      ingredients: nextIngredients.map((item) => item.name),
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
        select: { threadId: true, metadata: true },
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
        select: { threadId: true, metadata: true },
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

function toStockUpsertPayload(item: PhotoStockSaveItem) {
  const quantity = typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0
    ? item.quantity
    : 1
  return {
    name: item.name.trim(),
    inStock: true,
    quantity,
    unit: item.unit?.trim() || '個',
    ...(item.purchasedAt ? { purchasedAt: item.purchasedAt } : {}),
    ...(item.expiresAt ? { expiresAt: item.expiresAt } : {}),
    lastDetectedAt: new Date(),
    ...(typeof item.detectionConfidence === 'number' ? { detectionConfidence: item.detectionConfidence } : {}),
  }
}

export async function savePhotoDetectedStocks(
  id: number,
  input: SaveDiscordPhotoStockRequest,
): Promise<PhotoAnalysisDraftSummary> {
  const existing = await prisma.photoAnalysisDraft.findUnique({
    where: { id },
    include: { session: true },
  })
  if (!existing) throw new Error('写真解析下書きが見つかりません。')
  if (existing.session.discordUserId !== input.discordUserId) {
    throw new Error('この写真解析を更新できるのは作成したユーザーのみです。')
  }

  const items = input.items
    .map((item) => ({ ...item, name: item.name.trim() }))
    .filter((item) => item.name.length > 0)
  if (items.length === 0) {
    throw new Error('保存する在庫がありません。')
  }

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      if (item.action === 'skip') continue

      const targetName = item.existingStockName?.trim() || item.name
      const existingStock = await tx.stock.findUnique({
        where: {
          userId_name: {
            userId: existing.userId,
            name: targetName,
          },
        },
      })
      const payload = toStockUpsertPayload(item)

      if (item.action === 'merge' && existingStock) {
        await tx.stock.update({
          where: { id: existingStock.id },
          data: {
            ...payload,
            quantity: (existingStock.quantity ?? 0) + (payload.quantity ?? 1),
            unit: existingStock.unit ?? payload.unit,
            purchasedAt: payload.purchasedAt ?? existingStock.purchasedAt,
            expiresAt: payload.expiresAt ?? existingStock.expiresAt,
            detectionConfidence: Math.max(existingStock.detectionConfidence ?? 0, payload.detectionConfidence ?? 0),
          },
        })
        continue
      }

      await tx.stock.upsert({
        where: {
          userId_name: {
            userId: existing.userId,
            name: targetName,
          },
        },
        update: payload,
        create: {
          userId: existing.userId,
          ...payload,
          name: targetName,
        },
      })
    }

    await tx.photoAnalysisDraft.update({
      where: { id },
      data: {
        session: {
          update: {
            metadata: toJsonValue({
              ...(typeof existing.session.metadata === 'object' && existing.session.metadata !== null
                ? existing.session.metadata as Record<string, unknown>
                : {}),
              stockSaveSummary: {
                savedCount: items.filter((item) => item.action !== 'skip').length,
                names: items.filter((item) => item.action !== 'skip').map((item) => item.existingStockName?.trim() || item.name),
              },
            }),
          },
        },
      },
    })
  })

  await appendConversationTurn({
    sessionId: existing.sessionId,
    actorType: 'discord_user',
    actorId: input.discordUserId,
    eventType: 'photo_analysis_stock_saved',
    payload: {
      count: items.filter((item) => item.action !== 'skip').length,
      names: items.filter((item) => item.action !== 'skip').map((item) => item.existingStockName?.trim() || item.name),
    },
  })

  const updated = await prisma.photoAnalysisDraft.findUnique({
    where: { id },
    include: {
      session: {
        select: { threadId: true, metadata: true },
      },
    },
  })
  if (!updated) {
    throw new Error('写真解析下書きの再取得に失敗しました。')
  }
  return normalizePhotoDraft(updated)
}

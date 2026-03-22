import type { InputJsonValue } from '@prisma/client/runtime/library'
import type { KitchenAdviceMessage, KitchenAdviceSessionSummary } from '@kitchen/shared-types'
import { prisma } from '../../db/client.js'
import { ensureDiscordAppUser } from '../discord/userLink.js'
import { askGeminiConsultation } from '../gemini.js'

const DAILY_LIMIT = 20

function toJsonValue<T>(value: T): InputJsonValue {
  return value as InputJsonValue
}

function normalizeAdviceState(record: {
  id: number
  sessionId: number
  requestedServings: number
  latestResponse: string
  status: string
  session: { threadId: string | null }
  messages: KitchenAdviceMessage[]
}): KitchenAdviceSessionSummary {
  return {
    id: record.id,
    sessionId: record.sessionId,
    ...(record.session.threadId ? { threadId: record.session.threadId } : {}),
    status: record.status as KitchenAdviceSessionSummary['status'],
    requestedServings: record.requestedServings,
    latestResponse: record.latestResponse,
    messages: record.messages,
  }
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

async function getTodayUsageCount(userId: string): Promise<number> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return prisma.consultationLog.count({
    where: {
      userId,
      createdAt: { gte: todayStart },
    },
  })
}

async function buildAdviceContext(userId: string, requestedServings: number, history: KitchenAdviceMessage[], guidance?: string) {
  const [user, stocks, menu] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    }),
    prisma.stock.findMany({
      where: { userId, inStock: true },
      select: { name: true, inStock: true },
    }),
    prisma.weeklyMenu.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    }),
  ])

  let todayMenuTitle: string | undefined
  if (menu && Array.isArray(menu.items)) {
    const today = new Date().toISOString().slice(0, 10)
    const todayItem = (menu.items as Array<{ date?: string; recipeId?: number }>).find((item) => item.date === today)
    if (todayItem?.recipeId) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: todayItem.recipeId },
        select: { title: true },
      })
      todayMenuTitle = recipe?.title
    }
  }

  const preferences = user?.preferences as Record<string, unknown> | null
  const userPrompt = typeof preferences?.['userPrompt'] === 'string'
    ? preferences['userPrompt']
    : undefined

  return {
    todayMenuTitle,
    stockItems: stocks,
    userPrompt,
    requestedServings,
    guidance,
    history: history.map((entry) => ({
      actor: entry.actor,
      content: entry.content,
    })),
  }
}

export async function createKitchenAdviceSession(input: {
  guildId: string
  channelId: string
  threadId?: string
  discordUserId: string
  requestedServings: number
  question: string
}): Promise<KitchenAdviceSessionSummary> {
  const { userId } = await ensureDiscordAppUser({
    discordUserId: input.discordUserId,
    guildId: input.guildId,
  })

  const usageCount = await getTodayUsageCount(userId)
  if (usageCount >= DAILY_LIMIT) {
    throw new Error(`1日の相談回数上限(${DAILY_LIMIT}回)に達しました。`)
  }

  const context = await buildAdviceContext(userId, input.requestedServings, [])
  const response = await askGeminiConsultation(input.question, context)
  const messages: KitchenAdviceMessage[] = [
    { actor: 'user', content: input.question, createdAt: new Date() },
    { actor: 'assistant', content: response, createdAt: new Date() },
  ]

  const session = await prisma.conversationSession.create({
    data: {
      workflow: 'kitchen_advice',
      status: 'awaiting_user',
      guildId: input.guildId,
      channelId: input.channelId,
      threadId: input.threadId,
      discordUserId: input.discordUserId,
      requestedServings: input.requestedServings,
    },
  })

  const state = await prisma.kitchenAdviceState.create({
    data: {
      sessionId: session.id,
      userId,
      requestedServings: input.requestedServings,
      latestResponse: response,
      status: 'active',
    },
  })

  await prisma.consultationLog.create({
    data: {
      userId,
      message: input.question,
      response,
    },
  })

  await appendConversationTurn({
    sessionId: session.id,
    actorType: 'discord_user',
    actorId: input.discordUserId,
    eventType: 'kitchen_advice_created',
    payload: { question: input.question, response, messages },
  })

  return normalizeAdviceState({
    ...state,
    session: { threadId: input.threadId ?? null },
    messages,
  })
}

export async function getKitchenAdviceSessionById(id: number): Promise<KitchenAdviceSessionSummary | null> {
  const state = await prisma.kitchenAdviceState.findUnique({
    where: { id },
    include: {
      session: {
        select: { threadId: true, id: true },
      },
    },
  })
  if (!state) return null

  const turns = await prisma.conversationTurn.findMany({
    where: { sessionId: state.sessionId },
    orderBy: { createdAt: 'asc' },
  })
  const latestMessagesPayload = [...turns]
    .reverse()
    .find((turn) => turn.eventType === 'kitchen_advice_created' || turn.eventType === 'kitchen_advice_followup')
  const rawMessages = latestMessagesPayload
    ? (latestMessagesPayload.payload as Record<string, unknown>)['messages']
    : []
  const messages = Array.isArray(rawMessages) ? (rawMessages as KitchenAdviceMessage[]) : []

  return normalizeAdviceState({
    ...state,
    messages,
  })
}

export async function followUpKitchenAdviceSession(
  id: number,
  input: {
    discordUserId: string
    prompt: string
  },
): Promise<KitchenAdviceSessionSummary> {
  const state = await prisma.kitchenAdviceState.findUnique({
    where: { id },
    include: { session: true },
  })
  if (!state) throw new Error('料理相談セッションが見つかりません。')
  if (state.session.discordUserId !== input.discordUserId) {
    throw new Error('この料理相談を続けられるのは作成したユーザーのみです。')
  }

  const current = await getKitchenAdviceSessionById(id)
  if (!current) throw new Error('料理相談セッションが見つかりません。')

  const context = await buildAdviceContext(
    state.userId,
    state.requestedServings,
    current.messages,
    input.prompt,
  )
  const response = await askGeminiConsultation(input.prompt, context)
  const messages: KitchenAdviceMessage[] = [
    ...current.messages,
    { actor: 'user', content: input.prompt, createdAt: new Date() },
    { actor: 'assistant', content: response, createdAt: new Date() },
  ]

  const updated = await prisma.kitchenAdviceState.update({
    where: { id },
    data: { latestResponse: response },
    include: {
      session: {
        select: { threadId: true },
      },
    },
  })

  await prisma.consultationLog.create({
    data: {
      userId: state.userId,
      message: input.prompt,
      response,
    },
  })

  await appendConversationTurn({
    sessionId: state.sessionId,
    actorType: 'discord_user',
    actorId: input.discordUserId,
    eventType: 'kitchen_advice_followup',
    payload: { prompt: input.prompt, response, messages },
  })

  return normalizeAdviceState({
    ...updated,
    messages,
  })
}

export async function cancelKitchenAdviceSession(id: number, discordUserId: string): Promise<KitchenAdviceSessionSummary> {
  const state = await prisma.kitchenAdviceState.findUnique({
    where: { id },
    include: { session: true },
  })
  if (!state) throw new Error('料理相談セッションが見つかりません。')
  if (state.session.discordUserId !== discordUserId) {
    throw new Error('この料理相談を終了できるのは作成したユーザーのみです。')
  }

  const current = await getKitchenAdviceSessionById(id)
  if (!current) throw new Error('料理相談セッションが見つかりません。')

  const updated = await prisma.kitchenAdviceState.update({
    where: { id },
    data: {
      status: 'cancelled',
      session: {
        update: { status: 'cancelled' },
      },
    },
    include: {
      session: {
        select: { threadId: true },
      },
    },
  })

  await appendConversationTurn({
    sessionId: state.sessionId,
    actorType: 'discord_user',
    actorId: discordUserId,
    eventType: 'kitchen_advice_cancelled',
    payload: {},
  })

  return normalizeAdviceState({
    ...updated,
    messages: current.messages,
  })
}

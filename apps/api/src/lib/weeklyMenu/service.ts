import type { InputJsonValue } from '@prisma/client/runtime/library'
import type {
  ReplaceDiscordWeeklyMenuItemRequest,
  WeeklyMenuItem,
  WeeklyMenuProposalItem,
  WeeklyMenuProposalSummary,
} from '@kitchen/shared-types'
import { prisma } from '../../db/client.js'
import { ensureDiscordAppUser } from '../discord/userLink.js'
import { buildWeeklyMenuDayScore, type RecipeRecordLite } from '../discord/recipeMatchers.js'
import { getTokyoWeekForecast } from './tokyoWeather.js'

function toJsonValue<T>(value: T): InputJsonValue {
  return value as InputJsonValue
}

function normalizeProposal(record: {
  id: number
  sessionId: number
  requestedServings: number
  weekStartDate: string
  items: unknown
  notes: string | null
  status: string
  approvedWeeklyMenuId: number | null
  session: { threadId: string | null }
}): WeeklyMenuProposalSummary {
  return {
    id: record.id,
    sessionId: record.sessionId,
    ...(record.session.threadId ? { threadId: record.session.threadId } : {}),
    status: record.status as WeeklyMenuProposalSummary['status'],
    requestedServings: record.requestedServings,
    weekStartDate: record.weekStartDate,
    items: Array.isArray(record.items) ? (record.items as WeeklyMenuProposalItem[]) : [],
    ...(record.notes ? { notes: record.notes } : {}),
    ...(record.approvedWeeklyMenuId ? { approvedWeeklyMenuId: record.approvedWeeklyMenuId } : {}),
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

function selectRecipeForDay(params: {
  recipes: RecipeRecordLite[]
  selectedRecipeIds: Set<number>
  weatherText: string
  maxTempC: number
  precipitationMm: number
  dayIndex: number
  notes?: string
}): RecipeRecordLite {
  const availablePool = params.recipes.some((recipe) => !params.selectedRecipeIds.has(recipe.id))
    ? params.recipes.filter((recipe) => !params.selectedRecipeIds.has(recipe.id))
    : params.recipes

  const ranked = availablePool
    .map((recipe) => ({
      recipe,
      score: buildWeeklyMenuDayScore({
        recipe,
        selectedRecipeIds: params.selectedRecipeIds,
        weatherText: params.weatherText,
        maxTempC: params.maxTempC,
        precipitationMm: params.precipitationMm,
        dayIndex: params.dayIndex,
        notes: params.notes,
      }),
    }))
    .sort((left, right) => right.score - left.score)

  const selected = ranked[0]?.recipe
  if (!selected) {
    throw new Error('献立候補に使えるレシピがありません。')
  }
  return selected
}

async function loadWeeklyCandidateRecipes(): Promise<RecipeRecordLite[]> {
  return prisma.recipe.findMany({
    where: {
      category: { in: ['主菜', '一品料理'] },
    },
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

function buildProposalItems(params: {
  requestedServings: number
  recipes: RecipeRecordLite[]
  forecastDays: Awaited<ReturnType<typeof getTokyoWeekForecast>>['days']
  notes?: string
  existingItems?: WeeklyMenuProposalItem[]
  replaceDayIndex?: number
}): WeeklyMenuProposalItem[] {
  const selected = new Set<number>()
  const items: WeeklyMenuProposalItem[] = []

  params.forecastDays.forEach((day, index) => {
    if (params.existingItems && params.replaceDayIndex !== index) {
      const existing = params.existingItems[index]
      if (existing) {
        selected.add(existing.recipeId)
        items.push(existing)
        return
      }
    }

    const recipe = selectRecipeForDay({
      recipes: params.recipes,
      selectedRecipeIds: selected,
      weatherText: day.weatherText,
      maxTempC: day.maxTempC,
      precipitationMm: day.precipitationMm,
      dayIndex: index,
      notes: params.notes,
    })
    selected.add(recipe.id)
    items.push({
      date: day.date,
      weatherText: day.weatherText,
      maxTempC: day.maxTempC,
      precipitationMm: day.precipitationMm,
      recipeId: recipe.id,
      recipeTitle: recipe.title,
      device: recipe.device as WeeklyMenuProposalItem['device'],
      category: (recipe.category === '主菜' || recipe.category === '副菜' || recipe.category === 'スープ' || recipe.category === '一品料理' || recipe.category === 'スイーツ')
        ? recipe.category
        : '一品料理',
      servings: params.requestedServings,
      baseServings: recipe.baseServings,
      ...(params.notes && params.replaceDayIndex === index ? { replacementNotes: params.notes } : {}),
    })
  })

  return items
}

export async function createWeeklyMenuProposal(input: {
  guildId: string
  channelId: string
  threadId?: string
  discordUserId: string
  requestedServings: number
  notes?: string
}): Promise<WeeklyMenuProposalSummary> {
  const { userId } = await ensureDiscordAppUser({
    discordUserId: input.discordUserId,
    guildId: input.guildId,
  })

  const [forecast, recipes] = await Promise.all([
    getTokyoWeekForecast(),
    loadWeeklyCandidateRecipes(),
  ])

  const items = buildProposalItems({
    requestedServings: input.requestedServings,
    recipes,
    forecastDays: forecast.days,
    notes: input.notes,
  })

  const session = await prisma.conversationSession.create({
    data: {
      workflow: 'weekly_menu',
      status: 'awaiting_user',
      guildId: input.guildId,
      channelId: input.channelId,
      threadId: input.threadId,
      discordUserId: input.discordUserId,
      requestedServings: input.requestedServings,
      metadata: toJsonValue({
        weekStartDate: forecast.weekStartDate,
      }),
    },
  })

  const proposal = await prisma.weeklyMenuProposal.create({
    data: {
      sessionId: session.id,
      userId,
      requestedServings: input.requestedServings,
      weekStartDate: forecast.weekStartDate,
      items: toJsonValue(items),
      weatherSummary: toJsonValue(forecast.days),
      notes: input.notes,
      status: 'draft',
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
    eventType: 'weekly_menu_created',
    payload: {
      requestedServings: input.requestedServings,
      notes: input.notes,
    },
  })

  return normalizeProposal(proposal)
}

export async function getWeeklyMenuProposalById(id: number): Promise<WeeklyMenuProposalSummary | null> {
  const proposal = await prisma.weeklyMenuProposal.findUnique({
    where: { id },
    include: {
      session: {
        select: { threadId: true, discordUserId: true },
      },
    },
  })

  return proposal ? normalizeProposal(proposal) : null
}

export async function replaceWeeklyMenuProposalItem(
  id: number,
  input: ReplaceDiscordWeeklyMenuItemRequest,
): Promise<WeeklyMenuProposalSummary> {
  const existing = await prisma.weeklyMenuProposal.findUnique({
    where: { id },
    include: {
      session: true,
    },
  })
  if (!existing) throw new Error('週間献立案が見つかりません。')
  if (existing.session.discordUserId !== input.discordUserId) {
    throw new Error('この献立案を更新できるのは作成したユーザーのみです。')
  }

  const recipes = await loadWeeklyCandidateRecipes()
  const forecastDays = Array.isArray(existing.weatherSummary)
    ? (existing.weatherSummary as unknown as Awaited<ReturnType<typeof getTokyoWeekForecast>>['days'])
    : (await getTokyoWeekForecast()).days
  const currentItems = Array.isArray(existing.items) ? (existing.items as WeeklyMenuProposalItem[]) : []

  const items = buildProposalItems({
    requestedServings: existing.requestedServings,
    recipes,
    forecastDays,
    notes: input.notes,
    existingItems: currentItems,
    replaceDayIndex: input.dayIndex,
  })

  const proposal = await prisma.weeklyMenuProposal.update({
    where: { id },
    data: {
      items: toJsonValue(items),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
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
    eventType: 'weekly_menu_replaced',
    payload: {
      dayIndex: input.dayIndex,
      notes: input.notes,
    },
  })

  return normalizeProposal(proposal)
}

export async function approveWeeklyMenuProposal(id: number, discordUserId: string): Promise<WeeklyMenuProposalSummary> {
  const existing = await prisma.weeklyMenuProposal.findUnique({
    where: { id },
    include: {
      session: true,
    },
  })
  if (!existing) throw new Error('週間献立案が見つかりません。')
  if (existing.session.discordUserId !== discordUserId) {
    throw new Error('この献立案を承認できるのは作成したユーザーのみです。')
  }

  const items = Array.isArray(existing.items) ? (existing.items as WeeklyMenuProposalItem[]) : []
  const weeklyItems: WeeklyMenuItem[] = items.map((item) => ({
    recipeId: item.recipeId,
    mainServings: item.servings,
    date: item.date,
    mealType: 'dinner',
    locked: true,
  }))

  const menu = await prisma.weeklyMenu.upsert({
    where: {
      userId_weekStartDate: {
        userId: existing.userId,
        weekStartDate: existing.weekStartDate,
      },
    },
    update: {
      items: toJsonValue(weeklyItems),
      status: 'confirmed',
    },
    create: {
      userId: existing.userId,
      weekStartDate: existing.weekStartDate,
      items: toJsonValue(weeklyItems),
      status: 'confirmed',
    },
  })

  const proposal = await prisma.weeklyMenuProposal.update({
    where: { id },
    data: {
      status: 'persisted',
      approvedWeeklyMenuId: menu.id,
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
    eventType: 'weekly_menu_approved',
    payload: { weeklyMenuId: menu.id },
  })

  return normalizeProposal(proposal)
}

export async function cancelWeeklyMenuProposal(id: number, discordUserId: string): Promise<WeeklyMenuProposalSummary> {
  const existing = await prisma.weeklyMenuProposal.findUnique({
    where: { id },
    include: { session: true },
  })
  if (!existing) throw new Error('週間献立案が見つかりません。')
  if (existing.session.discordUserId !== discordUserId) {
    throw new Error('この献立案をキャンセルできるのは作成したユーザーのみです。')
  }

  const proposal = await prisma.weeklyMenuProposal.update({
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
    sessionId: existing.sessionId,
    actorType: 'discord_user',
    actorId: discordUserId,
    eventType: 'weekly_menu_cancelled',
    payload: {},
  })

  return normalizeProposal(proposal)
}

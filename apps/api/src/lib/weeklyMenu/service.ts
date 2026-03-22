import type { InputJsonValue } from '@prisma/client/runtime/library'
import type {
  ReplaceDiscordWeeklyMenuItemRequest,
  WeeklyMenuProposalItem,
  WeeklyMenuProposalItem as WeeklyMenuProposalItemType,
  WeeklyMenuItem,
  WeeklyMenuProposalSummary,
} from '@kitchen/shared-types'
import { prisma } from '../../db/client.js'
import { ensureDiscordAppUser } from '../discord/userLink.js'
import { normalizeUserPreferences } from '../userPreferences.js'
import { getTokyoWeekForecast } from './tokyoWeather.js'
import { ensureRecipeCatalogLoaded } from '../recipeCatalog.js'
import {
  buildWeeklyMenuProposalItems,
  type PlannerForecastDay,
  type PlannerRecipeRecord,
} from './planner.js'
import { WeeklyMenuProposalItemSchema } from '@kitchen/shared-types'

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
  const items = Array.isArray(record.items)
    ? WeeklyMenuProposalItemSchema.array().parse(record.items)
    : []

  return {
    id: record.id,
    sessionId: record.sessionId,
    ...(record.session.threadId ? { threadId: record.session.threadId } : {}),
    status: record.status as WeeklyMenuProposalSummary['status'],
    requestedServings: record.requestedServings,
    weekStartDate: record.weekStartDate,
    items,
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

async function loadWeeklyPlanningContext(userId: string): Promise<{
  recipes: PlannerRecipeRecord[]
  preferences: ReturnType<typeof normalizeUserPreferences>
  stockNames: Set<string>
  recentRecipeIds: Set<number>
  favoriteRecipeIds: Set<number>
}> {
  await ensureRecipeCatalogLoaded()

  const [user, recipes, stocks, favorites, recentMenus] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    }),
    prisma.recipe.findMany({
      select: {
        id: true,
        title: true,
        device: true,
        category: true,
        baseServings: true,
        totalTimeMinutes: true,
        ingredients: true,
      },
    }),
    prisma.stock.findMany({
      where: { userId, inStock: true },
      select: { name: true },
    }),
    prisma.favorite.findMany({
      where: { userId },
      select: { recipeId: true },
    }),
    prisma.weeklyMenu.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 4,
      select: { items: true },
    }),
  ])

  const recentRecipeIds = new Set<number>()
  for (const menu of recentMenus) {
    if (!Array.isArray(menu.items)) continue
    for (const item of menu.items as WeeklyMenuItem[]) {
      recentRecipeIds.add(item.recipeId)
      if (item.sideRecipeId != null) {
        recentRecipeIds.add(item.sideRecipeId)
      }
    }
  }

  return {
    recipes,
    preferences: normalizeUserPreferences(user?.preferences),
    stockNames: new Set(stocks.map((stock) => stock.name)),
    recentRecipeIds,
    favoriteRecipeIds: new Set(favorites.map((favorite) => favorite.recipeId)),
  }
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

  const [forecast, planning] = await Promise.all([
    getTokyoWeekForecast(),
    loadWeeklyPlanningContext(userId),
  ])

  const items = buildWeeklyMenuProposalItems({
    requestedServings: input.requestedServings,
    recipes: planning.recipes,
    forecastDays: forecast.days as PlannerForecastDay[],
    preferences: planning.preferences,
    stockNames: planning.stockNames,
    recentRecipeIds: planning.recentRecipeIds,
    favoriteRecipeIds: planning.favoriteRecipeIds,
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

  const planning = await loadWeeklyPlanningContext(existing.userId)
  const forecastDays = Array.isArray(existing.weatherSummary)
    ? (existing.weatherSummary as unknown as PlannerForecastDay[])
    : (await getTokyoWeekForecast()).days
  const currentItems: WeeklyMenuProposalItemType[] = Array.isArray(existing.items)
    ? WeeklyMenuProposalItemSchema.array().parse(existing.items)
    : []

  const items = buildWeeklyMenuProposalItems({
    requestedServings: existing.requestedServings,
    recipes: planning.recipes,
    forecastDays,
    preferences: planning.preferences,
    stockNames: planning.stockNames,
    recentRecipeIds: planning.recentRecipeIds,
    favoriteRecipeIds: planning.favoriteRecipeIds,
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

  const items: WeeklyMenuProposalItem[] = Array.isArray(existing.items)
    ? WeeklyMenuProposalItemSchema.array().parse(existing.items)
    : []
  const weeklyItems: WeeklyMenuItem[] = items.map((item) => ({
    recipeId: item.recipeId,
    ...(item.sideRecipeId ? { sideRecipeId: item.sideRecipeId } : {}),
    mainServings: item.servings,
    ...(item.sideRecipeId ? { sideServings: item.servings } : {}),
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

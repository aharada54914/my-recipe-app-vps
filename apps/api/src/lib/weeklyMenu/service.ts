import type { InputJsonValue } from '@prisma/client/runtime/library'
import type {
  ReplaceDiscordWeeklyMenuItemRequest,
  WeeklyMenuCandidate,
  WeeklyMenuProposalItem,
  WeeklyMenuProposalItem as WeeklyMenuProposalItemType,
  WeeklyMenuItem,
  WeeklyMenuPreset,
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
import { registerWeeklyMenuToFamilyCalendar } from '../googleCalendar.js'

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
  session: {
    threadId: string | null
    metadata?: unknown
  }
}): WeeklyMenuProposalSummary {
  const items = normalizeStoredProposalItems(record.items)
  const metadata = isRecord(record.session.metadata) ? record.session.metadata : {}
  const excludedRecipeIds = Array.isArray(metadata.excludedRecipeIds)
    ? metadata.excludedRecipeIds.filter((value): value is number => typeof value === 'number')
    : []
  const calendarSync = isRecord(metadata.calendarSync)
    ? {
      status: normalizeCalendarSyncStatus(metadata.calendarSync.status),
      ...(typeof metadata.calendarSync.calendarId === 'string'
        ? { calendarId: metadata.calendarSync.calendarId }
        : {}),
      ...(typeof metadata.calendarSync.registeredCount === 'number'
        ? { registeredCount: metadata.calendarSync.registeredCount }
        : {}),
      ...(Array.isArray(metadata.calendarSync.errors)
        ? { errors: metadata.calendarSync.errors.filter((value): value is string => typeof value === 'string') }
        : {}),
    }
    : undefined
  const preset = metadata.preset === 'washoku_focus' || metadata.preset === 'budget_saver' || metadata.preset === 'fish_more'
    ? metadata.preset as WeeklyMenuPreset
    : undefined

  return {
    id: record.id,
    sessionId: record.sessionId,
    ...(record.session.threadId ? { threadId: record.session.threadId } : {}),
    status: record.status as WeeklyMenuProposalSummary['status'],
    requestedServings: record.requestedServings,
    weekStartDate: record.weekStartDate,
    items,
    ...(preset ? { preset } : {}),
    ...(record.notes ? { notes: record.notes } : {}),
    ...(record.approvedWeeklyMenuId ? { approvedWeeklyMenuId: record.approvedWeeklyMenuId } : {}),
    excludedRecipeIds,
    ...(calendarSync ? { calendarSync } : {}),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeCalendarSyncStatus(value: unknown): 'not_started' | 'registered' | 'failed' {
  return value === 'registered' || value === 'failed' ? value : 'not_started'
}

function normalizeStoredProposalItems(value: unknown): WeeklyMenuProposalItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const parsed = WeeklyMenuProposalItemSchema.safeParse(entry)
      if (parsed.success) return parsed.data
      if (!isRecord(entry)) return null

      const recipeId = typeof entry.recipeId === 'number' ? entry.recipeId : undefined
      const recipeTitle = typeof entry.recipeTitle === 'string' ? entry.recipeTitle : undefined
      const device = entry.device
      const category = entry.category
      const baseServings = typeof entry.baseServings === 'number' ? entry.baseServings : undefined
      if (
        recipeId == null ||
        recipeTitle == null ||
        baseServings == null ||
        (device !== 'manual' && device !== 'hotcook' && device !== 'healsio') ||
        (category !== '主菜' && category !== '副菜' && category !== 'スープ' && category !== '一品料理' && category !== 'スイーツ')
      ) {
        return null
      }

      const mainCandidate: WeeklyMenuCandidate = {
        recipeId,
        title: recipeTitle,
        device,
        category,
        baseServings,
        score: 0,
        ...(typeof entry.scoreSummary === 'string' ? { scoreSummary: entry.scoreSummary } : {}),
      }
      const sideCandidate =
        typeof entry.sideRecipeId === 'number' &&
        typeof entry.sideRecipeTitle === 'string' &&
        typeof entry.sideDevice === 'string' &&
        typeof entry.sideCategory === 'string'
          ? {
            recipeId: entry.sideRecipeId,
            title: entry.sideRecipeTitle,
            device: entry.sideDevice,
            category: entry.sideCategory,
            baseServings,
            score: 0,
          }
          : undefined

      return WeeklyMenuProposalItemSchema.parse({
        ...entry,
        mainCandidates: [mainCandidate],
        currentMainCandidateIndex: 0,
        ...(sideCandidate ? { sideCandidates: [sideCandidate], currentSideCandidateIndex: 0 } : {}),
        excludedRecipeIds: [],
        replacementHistory: [],
      })
    })
    .filter((entry): entry is WeeklyMenuProposalItem => entry != null)
}

function materializeProposalCandidateUpdate(params: {
  item: WeeklyMenuProposalItem
  target: 'main' | 'side'
  nextIndex: number
  notes?: string
}): WeeklyMenuProposalItem {
  const historyLabel = params.target === 'main' ? '主菜' : '副菜'
  if (params.target === 'main') {
    const candidate = params.item.mainCandidates[params.nextIndex]
    return {
      ...params.item,
      recipeId: candidate.recipeId,
      recipeTitle: candidate.title,
      device: candidate.device,
      category: candidate.category,
      baseServings: candidate.baseServings,
      scoreSummary: candidate.scoreSummary ?? params.item.scoreSummary,
      currentMainCandidateIndex: params.nextIndex,
      replacementHistory: [
        ...params.item.replacementHistory,
        `${historyLabel}を次候補へ: ${candidate.title}`,
      ],
      ...(params.notes ? { replacementNotes: params.notes } : {}),
    }
  }

  const candidate = params.item.sideCandidates?.[params.nextIndex]
  return {
    ...params.item,
    sideRecipeId: candidate?.recipeId,
    sideRecipeTitle: candidate?.title,
    sideDevice: candidate?.device,
    sideCategory: candidate?.category,
    currentSideCandidateIndex: params.nextIndex,
    replacementHistory: [
      ...params.item.replacementHistory,
      `${historyLabel}を次候補へ: ${candidate?.title ?? 'なし'}`,
    ],
    ...(params.notes ? { replacementNotes: params.notes } : {}),
  }
}

function findNextCandidateIndex(params: {
  item: WeeklyMenuProposalItem
  target: 'main' | 'side'
  globalExcludedRecipeIds: Set<number>
  avoidProteinGroups?: Set<WeeklyMenuCandidate['proteinGroup']>
}): number | null {
  const candidates = params.target === 'main'
    ? params.item.mainCandidates
    : (params.item.sideCandidates ?? [])
  const currentIndex = params.target === 'main'
    ? params.item.currentMainCandidateIndex
    : (params.item.currentSideCandidateIndex ?? -1)

  for (let index = currentIndex + 1; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    if (params.globalExcludedRecipeIds.has(candidate.recipeId)) continue
    if (params.item.excludedRecipeIds.includes(candidate.recipeId)) continue
    if (params.avoidProteinGroups?.has(candidate.proteinGroup)) continue
    return index
  }
  return null
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
  expiringStockNames: Set<string>
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
      select: { name: true, expiresAt: true },
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
    expiringStockNames: new Set(
      stocks
        .filter((stock) => stock.expiresAt && stock.expiresAt.getTime() <= Date.now() + (1000 * 60 * 60 * 24 * 3))
        .map((stock) => stock.name),
    ),
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
  preset?: WeeklyMenuPreset
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
    expiringStockNames: planning.expiringStockNames,
    recentRecipeIds: planning.recentRecipeIds,
    favoriteRecipeIds: planning.favoriteRecipeIds,
    ...(input.preset ? { preset: input.preset } : {}),
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
        excludedRecipeIds: [],
        ...(input.preset ? { preset: input.preset } : {}),
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
        select: { threadId: true, metadata: true },
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
      ...(input.preset ? { preset: input.preset } : {}),
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
        select: { threadId: true, discordUserId: true, metadata: true },
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
  const currentItems: WeeklyMenuProposalItemType[] = normalizeStoredProposalItems(existing.items)
  const metadata = isRecord(existing.session.metadata) ? existing.session.metadata : {}
  const globalExcludedRecipeIds = new Set<number>(
    Array.isArray(metadata.excludedRecipeIds)
      ? metadata.excludedRecipeIds.filter((value): value is number => typeof value === 'number')
      : [],
  )
  const replaceTarget = input.target ?? 'main'
  const replaceStrategy = input.strategy ?? 'next_candidate'
  const nextItems = [...currentItems]
  const currentItem = nextItems[input.dayIndex]
  if (!currentItem) {
    throw new Error('差し替える日が見つかりません。')
  }

  if (replaceStrategy === 'blacklist_current') {
    const recipeIdToExclude = replaceTarget === 'main' ? currentItem.recipeId : currentItem.sideRecipeId
    if (recipeIdToExclude != null) {
      globalExcludedRecipeIds.add(recipeIdToExclude)
    }
    nextItems[input.dayIndex] = {
      ...currentItem,
      excludedRecipeIds: Array.from(new Set([
        ...currentItem.excludedRecipeIds,
        ...(recipeIdToExclude != null ? [recipeIdToExclude] : []),
      ])),
      replacementHistory: [
        ...currentItem.replacementHistory,
        `${replaceTarget === 'main' ? '主菜' : '副菜'}候補を今週から除外`,
      ],
      ...(input.notes ? { replacementNotes: input.notes } : {}),
    }
  }

  let items = nextItems
  const sourceItem = items[input.dayIndex]
  const avoidProteinGroups =
    input.avoidSameMainIngredient && replaceTarget === 'main'
      ? new Set<WeeklyMenuCandidate['proteinGroup']>([
        sourceItem.mainCandidates[sourceItem.currentMainCandidateIndex]?.proteinGroup,
      ])
      : undefined
  const nextCandidateIndex =
    replaceStrategy === 'rebuild_stock_priority'
      ? null
      : findNextCandidateIndex({
        item: sourceItem,
        target: replaceTarget,
        globalExcludedRecipeIds,
        ...(avoidProteinGroups ? { avoidProteinGroups } : {}),
      })

  if (nextCandidateIndex != null) {
    items[input.dayIndex] = materializeProposalCandidateUpdate({
      item: sourceItem,
      target: replaceTarget,
      nextIndex: nextCandidateIndex,
      ...(input.notes ? { notes: input.notes } : {}),
    })
  } else {
    items = buildWeeklyMenuProposalItems({
      requestedServings: existing.requestedServings,
      recipes: planning.recipes,
      forecastDays,
      preferences: planning.preferences,
      stockNames: planning.stockNames,
      expiringStockNames: planning.expiringStockNames,
      recentRecipeIds: planning.recentRecipeIds,
      favoriteRecipeIds: planning.favoriteRecipeIds,
      ...(metadata.preset === 'washoku_focus' || metadata.preset === 'budget_saver' || metadata.preset === 'fish_more'
        ? { preset: metadata.preset as WeeklyMenuPreset }
        : {}),
      notes: input.notes,
      existingItems: nextItems,
      replaceDayIndex: input.dayIndex,
      replaceTarget,
      globalExcludedRecipeIds,
      ...(avoidProteinGroups ? { avoidProteinGroups } : {}),
    })
  }

  const proposal = await prisma.weeklyMenuProposal.update({
    where: { id },
    data: {
      items: toJsonValue(items),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      session: {
        update: {
          metadata: toJsonValue({
            ...metadata,
            excludedRecipeIds: Array.from(globalExcludedRecipeIds),
          }),
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
    actorId: input.discordUserId,
    eventType: 'weekly_menu_replaced',
    payload: {
      dayIndex: input.dayIndex,
      target: replaceTarget,
      strategy: replaceStrategy,
      avoidSameMainIngredient: input.avoidSameMainIngredient ?? false,
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
  if (existing.status === 'persisted') {
    return normalizeProposal(existing)
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

  let calendarSync:
    | { status: 'registered'; calendarId: string; registeredCount: number; errors: string[] }
    | { status: 'failed'; registeredCount: number; errors: string[] }
    | undefined

  try {
    const registration = await registerWeeklyMenuToFamilyCalendar({
      userId: existing.userId,
      weekStartDate: existing.weekStartDate,
      items: weeklyItems,
    })
    calendarSync = {
      status: registration.errors.length === 0 ? 'registered' : 'failed',
      calendarId: registration.calendarId,
      registeredCount: registration.registeredCount,
      errors: registration.errors,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    calendarSync = {
      status: 'failed',
      registeredCount: 0,
      errors: [message],
    }
  }

  const proposal = await prisma.weeklyMenuProposal.update({
    where: { id },
    data: {
      status: 'persisted',
      approvedWeeklyMenuId: menu.id,
      session: {
        update: {
          status: 'completed',
          approvedAt: new Date(),
          metadata: toJsonValue({
            ...(isRecord(existing.session.metadata) ? existing.session.metadata : {}),
            calendarSync,
          }),
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
    eventType: 'weekly_menu_approved',
    payload: {
      weeklyMenuId: menu.id,
      ...(calendarSync ? { calendarSync } : {}),
    },
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
        select: { threadId: true, metadata: true },
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

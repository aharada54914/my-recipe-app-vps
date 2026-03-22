import {
  type CreateDiscordKitchenAdviceRequest,
  type CreateDiscordPhotoAnalysisRequest,
  type CreateDiscordRecipeImportDraftRequest,
  type CreateDiscordWeeklyMenuProposalRequest,
  type DiscordWorkflow,
  type KitchenAdviceSessionSummary,
  type PhotoAnalysisDraftSummary,
  type ReplaceDiscordWeeklyMenuItemRequest,
  type RecipeImportDraftSummary,
  type SelectDiscordPhotoCandidateRequest,
  type UpdateDiscordRecipeImportDraftRequest,
  type UpdateDiscordPhotoAnalysisRequest,
  type WeeklyMenuProposalSummary,
} from '@kitchen/shared-types'

interface ApiEnvelope<T> {
  success: boolean
  data?: T
  error?: string
}

function getApiBaseUrl(): string {
  return process.env['KITCHEN_API_BASE_URL'] ?? 'http://127.0.0.1:3001'
}

function getInternalToken(): string {
  const token = process.env['DISCORD_INTERNAL_API_TOKEN']
  if (!token) {
    throw new Error('DISCORD_INTERNAL_API_TOKEN is not configured')
  }
  return token
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-internal-token': getInternalToken(),
      ...(init?.headers ?? {}),
    },
  })

  const payload = await response.json() as ApiEnvelope<T>
  if (!response.ok || !payload.success || payload.data == null) {
    throw new Error(payload.error ?? `Internal API request failed (${response.status})`)
  }
  return payload.data
}

export async function bindWorkflowChannel(input: {
  guildId: string
  workflow: DiscordWorkflow
  channelId: string
}): Promise<void> {
  await request<true>(`/api/internal/discord/channel-bindings/${input.workflow}`, {
    method: 'PUT',
    body: JSON.stringify({
      guildId: input.guildId,
      channelId: input.channelId,
    }),
  })
}

export async function getWorkflowChannel(input: {
  guildId: string
  workflow: DiscordWorkflow
}): Promise<string | null> {
  const data = await request<{ channelId: string | null }>(
    `/api/internal/discord/channel-bindings/${input.workflow}?guildId=${encodeURIComponent(input.guildId)}`,
  )
  return data.channelId
}

export async function createRecipeImportDraft(
  input: CreateDiscordRecipeImportDraftRequest,
): Promise<RecipeImportDraftSummary> {
  return request<RecipeImportDraftSummary>('/api/internal/discord/recipe-imports', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getRecipeImportDraft(id: number): Promise<RecipeImportDraftSummary> {
  return request<RecipeImportDraftSummary>(`/api/internal/discord/recipe-imports/${id}`)
}

export async function updateRecipeImportDraft(input: {
  id: number
  discordUserId: string
  patch: UpdateDiscordRecipeImportDraftRequest
}): Promise<RecipeImportDraftSummary> {
  return request<RecipeImportDraftSummary>(`/api/internal/discord/recipe-imports/${input.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      discordUserId: input.discordUserId,
      patch: input.patch,
    }),
  })
}

export async function approveRecipeImportDraft(input: {
  id: number
  discordUserId: string
}): Promise<RecipeImportDraftSummary> {
  return request<RecipeImportDraftSummary>(`/api/internal/discord/recipe-imports/${input.id}/approve`, {
    method: 'POST',
    body: JSON.stringify({
      discordUserId: input.discordUserId,
    }),
  })
}

export async function cancelRecipeImportDraft(input: {
  id: number
  discordUserId: string
}): Promise<RecipeImportDraftSummary> {
  return request<RecipeImportDraftSummary>(`/api/internal/discord/recipe-imports/${input.id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({
      discordUserId: input.discordUserId,
    }),
  })
}

export async function createWeeklyMenuProposal(
  input: CreateDiscordWeeklyMenuProposalRequest,
): Promise<WeeklyMenuProposalSummary> {
  return request<WeeklyMenuProposalSummary>('/api/internal/discord/weekly-menu-proposals', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getWeeklyMenuProposal(id: number): Promise<WeeklyMenuProposalSummary> {
  return request<WeeklyMenuProposalSummary>(`/api/internal/discord/weekly-menu-proposals/${id}`)
}

export async function replaceWeeklyMenuItem(input: {
  id: number
  patch: ReplaceDiscordWeeklyMenuItemRequest
}): Promise<WeeklyMenuProposalSummary> {
  return request<WeeklyMenuProposalSummary>(`/api/internal/discord/weekly-menu-proposals/${input.id}/replace`, {
    method: 'POST',
    body: JSON.stringify(input.patch),
  })
}

export async function approveWeeklyMenuProposal(input: {
  id: number
  discordUserId: string
}): Promise<WeeklyMenuProposalSummary> {
  return request<WeeklyMenuProposalSummary>(`/api/internal/discord/weekly-menu-proposals/${input.id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ discordUserId: input.discordUserId }),
  })
}

export async function cancelWeeklyMenuProposal(input: {
  id: number
  discordUserId: string
}): Promise<WeeklyMenuProposalSummary> {
  return request<WeeklyMenuProposalSummary>(`/api/internal/discord/weekly-menu-proposals/${input.id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ discordUserId: input.discordUserId }),
  })
}

export async function createPhotoAnalysisDraft(
  input: CreateDiscordPhotoAnalysisRequest,
): Promise<PhotoAnalysisDraftSummary> {
  return request<PhotoAnalysisDraftSummary>('/api/internal/discord/photo-analysis', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getPhotoAnalysisDraft(id: number): Promise<PhotoAnalysisDraftSummary> {
  return request<PhotoAnalysisDraftSummary>(`/api/internal/discord/photo-analysis/${id}`)
}

export async function updatePhotoAnalysisDraft(
  input: UpdateDiscordPhotoAnalysisRequest & { id: number },
): Promise<PhotoAnalysisDraftSummary> {
  return request<PhotoAnalysisDraftSummary>(`/api/internal/discord/photo-analysis/${input.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      discordUserId: input.discordUserId,
      ...(input.ingredients ? { ingredients: input.ingredients } : {}),
      ...(input.excludeRecipeIds ? { excludeRecipeIds: input.excludeRecipeIds } : {}),
    }),
  })
}

export async function selectPhotoCandidate(
  input: SelectDiscordPhotoCandidateRequest & { id: number },
): Promise<PhotoAnalysisDraftSummary> {
  return request<PhotoAnalysisDraftSummary>(`/api/internal/discord/photo-analysis/${input.id}/select`, {
    method: 'POST',
    body: JSON.stringify({
      discordUserId: input.discordUserId,
      recipeId: input.recipeId,
    }),
  })
}

export async function cancelPhotoAnalysisDraft(input: {
  id: number
  discordUserId: string
}): Promise<PhotoAnalysisDraftSummary> {
  return request<PhotoAnalysisDraftSummary>(`/api/internal/discord/photo-analysis/${input.id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ discordUserId: input.discordUserId }),
  })
}

export async function createKitchenAdviceSession(
  input: CreateDiscordKitchenAdviceRequest,
): Promise<KitchenAdviceSessionSummary> {
  return request<KitchenAdviceSessionSummary>('/api/internal/discord/kitchen-advice', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getKitchenAdviceSession(id: number): Promise<KitchenAdviceSessionSummary> {
  return request<KitchenAdviceSessionSummary>(`/api/internal/discord/kitchen-advice/${id}`)
}

export async function followUpKitchenAdviceSession(input: {
  id: number
  discordUserId: string
  prompt: string
}): Promise<KitchenAdviceSessionSummary> {
  return request<KitchenAdviceSessionSummary>(`/api/internal/discord/kitchen-advice/${input.id}/follow-up`, {
    method: 'POST',
    body: JSON.stringify({
      discordUserId: input.discordUserId,
      prompt: input.prompt,
    }),
  })
}

export async function cancelKitchenAdviceSession(input: {
  id: number
  discordUserId: string
}): Promise<KitchenAdviceSessionSummary> {
  return request<KitchenAdviceSessionSummary>(`/api/internal/discord/kitchen-advice/${input.id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ discordUserId: input.discordUserId }),
  })
}

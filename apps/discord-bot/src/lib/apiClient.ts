import {
  type CreateDiscordRecipeImportDraftRequest,
  type DiscordWorkflow,
  type RecipeImportDraftSummary,
  type UpdateDiscordRecipeImportDraftRequest,
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

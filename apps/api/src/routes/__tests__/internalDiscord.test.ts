import Fastify, { type FastifyInstance } from 'fastify'
import type { InjectOptions } from 'light-my-request'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  bindDiscordWorkflowChannelMock: vi.fn(),
  getDiscordWorkflowChannelMock: vi.fn(),
  createRecipeImportDraftMock: vi.fn(),
  getRecipeImportDraftByIdMock: vi.fn(),
  updateRecipeImportDraftMock: vi.fn(),
  approveRecipeImportDraftMock: vi.fn(),
  cancelRecipeImportDraftMock: vi.fn(),

  createWeeklyMenuProposalMock: vi.fn(),
  getWeeklyMenuProposalByIdMock: vi.fn(),
  replaceWeeklyMenuProposalItemMock: vi.fn(),
  approveWeeklyMenuProposalMock: vi.fn(),
  cancelWeeklyMenuProposalMock: vi.fn(),

  createPhotoAnalysisDraftMock: vi.fn(),
  getPhotoAnalysisDraftByIdMock: vi.fn(),
  updatePhotoAnalysisDraftMock: vi.fn(),
  selectPhotoCandidateMock: vi.fn(),
  cancelPhotoAnalysisDraftMock: vi.fn(),

  createKitchenAdviceSessionMock: vi.fn(),
  getKitchenAdviceSessionByIdMock: vi.fn(),
  followUpKitchenAdviceSessionMock: vi.fn(),
  cancelKitchenAdviceSessionMock: vi.fn(),
}))

vi.mock('../../lib/recipeImport/service.js', () => ({
  bindDiscordWorkflowChannel: mocks.bindDiscordWorkflowChannelMock,
  getDiscordWorkflowChannel: mocks.getDiscordWorkflowChannelMock,
  createRecipeImportDraft: mocks.createRecipeImportDraftMock,
  getRecipeImportDraftById: mocks.getRecipeImportDraftByIdMock,
  updateRecipeImportDraft: mocks.updateRecipeImportDraftMock,
  approveRecipeImportDraft: mocks.approveRecipeImportDraftMock,
  cancelRecipeImportDraft: mocks.cancelRecipeImportDraftMock,
}))

vi.mock('../../lib/weeklyMenu/service.js', () => ({
  createWeeklyMenuProposal: mocks.createWeeklyMenuProposalMock,
  getWeeklyMenuProposalById: mocks.getWeeklyMenuProposalByIdMock,
  replaceWeeklyMenuProposalItem: mocks.replaceWeeklyMenuProposalItemMock,
  approveWeeklyMenuProposal: mocks.approveWeeklyMenuProposalMock,
  cancelWeeklyMenuProposal: mocks.cancelWeeklyMenuProposalMock,
}))

vi.mock('../../lib/stockPhoto/service.js', () => ({
  createPhotoAnalysisDraft: mocks.createPhotoAnalysisDraftMock,
  getPhotoAnalysisDraftById: mocks.getPhotoAnalysisDraftByIdMock,
  updatePhotoAnalysisDraft: mocks.updatePhotoAnalysisDraftMock,
  selectPhotoCandidate: mocks.selectPhotoCandidateMock,
  cancelPhotoAnalysisDraft: mocks.cancelPhotoAnalysisDraftMock,
}))

vi.mock('../../lib/kitchenAdvice/service.js', () => ({
  createKitchenAdviceSession: mocks.createKitchenAdviceSessionMock,
  getKitchenAdviceSessionById: mocks.getKitchenAdviceSessionByIdMock,
  followUpKitchenAdviceSession: mocks.followUpKitchenAdviceSessionMock,
  cancelKitchenAdviceSession: mocks.cancelKitchenAdviceSessionMock,
}))

import { registerInternalDiscordRoutes } from '../internalDiscord.js'

const AUTH_TOKEN = 'test-internal-token'

const recipeImportDraft = { id: 11, status: 'draft' }
const weeklyMenuProposal = { id: 21, status: 'draft' }
const photoAnalysisDraft = { id: 31, status: 'draft' }
const kitchenAdviceSession = { id: 41, status: 'active' }

type EndpointCase = {
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  url: string
  payload?: unknown
  expectedStatus: number
  verify: () => void
}

function authHeaders() {
  return { 'x-internal-token': AUTH_TOKEN }
}

function injectOptions(endpointCase: EndpointCase, includeAuth = false): InjectOptions {
  const options: InjectOptions = {
    method: endpointCase.method,
    url: endpointCase.url,
  }
  if (includeAuth) {
    options.headers = authHeaders()
  }
  if (endpointCase.payload !== undefined) {
    options.payload = endpointCase.payload as Record<string, unknown>
  }
  return options
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify()
  await registerInternalDiscordRoutes(app)
  await app.ready()
  return app
}

function resetServiceMocks(): void {
  mocks.bindDiscordWorkflowChannelMock.mockResolvedValue(undefined)
  mocks.getDiscordWorkflowChannelMock.mockResolvedValue('channel-1')
  mocks.createRecipeImportDraftMock.mockResolvedValue(recipeImportDraft)
  mocks.getRecipeImportDraftByIdMock.mockResolvedValue(recipeImportDraft)
  mocks.updateRecipeImportDraftMock.mockResolvedValue(recipeImportDraft)
  mocks.approveRecipeImportDraftMock.mockResolvedValue(recipeImportDraft)
  mocks.cancelRecipeImportDraftMock.mockResolvedValue(recipeImportDraft)

  mocks.createWeeklyMenuProposalMock.mockResolvedValue(weeklyMenuProposal)
  mocks.getWeeklyMenuProposalByIdMock.mockResolvedValue(weeklyMenuProposal)
  mocks.replaceWeeklyMenuProposalItemMock.mockResolvedValue(weeklyMenuProposal)
  mocks.approveWeeklyMenuProposalMock.mockResolvedValue(weeklyMenuProposal)
  mocks.cancelWeeklyMenuProposalMock.mockResolvedValue(weeklyMenuProposal)

  mocks.createPhotoAnalysisDraftMock.mockResolvedValue(photoAnalysisDraft)
  mocks.getPhotoAnalysisDraftByIdMock.mockResolvedValue(photoAnalysisDraft)
  mocks.updatePhotoAnalysisDraftMock.mockResolvedValue(photoAnalysisDraft)
  mocks.selectPhotoCandidateMock.mockResolvedValue(photoAnalysisDraft)
  mocks.cancelPhotoAnalysisDraftMock.mockResolvedValue(photoAnalysisDraft)

  mocks.createKitchenAdviceSessionMock.mockResolvedValue(kitchenAdviceSession)
  mocks.getKitchenAdviceSessionByIdMock.mockResolvedValue(kitchenAdviceSession)
  mocks.followUpKitchenAdviceSessionMock.mockResolvedValue(kitchenAdviceSession)
  mocks.cancelKitchenAdviceSessionMock.mockResolvedValue(kitchenAdviceSession)
}

const endpointCases: EndpointCase[] = [
  {
    name: 'channel binding update',
    method: 'PUT',
    url: '/api/internal/discord/channel-bindings/recipe_import',
    payload: { guildId: 'guild-1', channelId: 'channel-1' },
    expectedStatus: 200,
    verify: () => {
      expect(mocks.bindDiscordWorkflowChannelMock).toHaveBeenCalledWith({
        guildId: 'guild-1',
        workflow: 'recipe_import',
        channelId: 'channel-1',
      })
    },
  },
  {
    name: 'channel binding fetch',
    method: 'GET',
    url: '/api/internal/discord/channel-bindings/recipe_import?guildId=guild-1',
    expectedStatus: 200,
    verify: () => {
      expect(mocks.getDiscordWorkflowChannelMock).toHaveBeenCalledWith({
        guildId: 'guild-1',
        workflow: 'recipe_import',
      })
    },
  },
  {
    name: 'recipe import create',
    method: 'POST',
    url: '/api/internal/discord/recipe-imports',
    payload: {
      guildId: 'guild-1',
      channelId: 'channel-1',
      threadId: 'thread-1',
      discordUserId: 'discord-user-1',
      requestedServings: 4,
      url: 'https://example.com/recipes/1',
    },
    expectedStatus: 201,
    verify: () => {
      expect(mocks.createRecipeImportDraftMock).toHaveBeenCalledWith({
        guildId: 'guild-1',
        channelId: 'channel-1',
        threadId: 'thread-1',
        discordUserId: 'discord-user-1',
        requestedServings: 4,
        url: 'https://example.com/recipes/1',
      })
    },
  },
  {
    name: 'recipe import fetch',
    method: 'GET',
    url: '/api/internal/discord/recipe-imports/11',
    expectedStatus: 200,
    verify: () => {
      expect(mocks.getRecipeImportDraftByIdMock).toHaveBeenCalledWith(11)
    },
  },
  {
    name: 'recipe import patch',
    method: 'PATCH',
    url: '/api/internal/discord/recipe-imports/11',
    payload: {
      discordUserId: 'discord-user-1',
      patch: { title: 'updated title', baseServings: 3 },
    },
    expectedStatus: 200,
    verify: () => {
      expect(mocks.updateRecipeImportDraftMock).toHaveBeenCalledWith(
        11,
        { title: 'updated title', baseServings: 3 },
        'discord-user-1',
      )
    },
  },
  {
    name: 'recipe import approve',
    method: 'POST',
    url: '/api/internal/discord/recipe-imports/11/approve',
    payload: { discordUserId: 'discord-user-1' },
    expectedStatus: 200,
    verify: () => {
      expect(mocks.approveRecipeImportDraftMock).toHaveBeenCalledWith(11, 'discord-user-1')
    },
  },
  {
    name: 'recipe import cancel',
    method: 'POST',
    url: '/api/internal/discord/recipe-imports/11/cancel',
    payload: { discordUserId: 'discord-user-1' },
    expectedStatus: 200,
    verify: () => {
      expect(mocks.cancelRecipeImportDraftMock).toHaveBeenCalledWith(11, 'discord-user-1')
    },
  },
  {
    name: 'weekly menu create',
    method: 'POST',
    url: '/api/internal/discord/weekly-menu-proposals',
    payload: {
      guildId: 'guild-1',
      channelId: 'channel-1',
      threadId: 'thread-1',
      discordUserId: 'discord-user-1',
      requestedServings: 4,
      notes: '雨の日向け',
    },
    expectedStatus: 201,
    verify: () => {
      expect(mocks.createWeeklyMenuProposalMock).toHaveBeenCalledWith({
        guildId: 'guild-1',
        channelId: 'channel-1',
        threadId: 'thread-1',
        discordUserId: 'discord-user-1',
        requestedServings: 4,
        notes: '雨の日向け',
      })
    },
  },
  {
    name: 'weekly menu fetch',
    method: 'GET',
    url: '/api/internal/discord/weekly-menu-proposals/21',
    expectedStatus: 200,
    verify: () => {
      expect(mocks.getWeeklyMenuProposalByIdMock).toHaveBeenCalledWith(21)
    },
  },
  {
    name: 'weekly menu replace',
    method: 'POST',
    url: '/api/internal/discord/weekly-menu-proposals/21/replace',
    payload: { dayIndex: 2, discordUserId: 'discord-user-1', notes: 'もっと軽め' },
    expectedStatus: 200,
    verify: () => {
      expect(mocks.replaceWeeklyMenuProposalItemMock).toHaveBeenCalledWith(21, {
        dayIndex: 2,
        discordUserId: 'discord-user-1',
        notes: 'もっと軽め',
      })
    },
  },
  {
    name: 'weekly menu approve',
    method: 'POST',
    url: '/api/internal/discord/weekly-menu-proposals/21/approve',
    payload: { discordUserId: 'discord-user-1' },
    expectedStatus: 200,
    verify: () => {
      expect(mocks.approveWeeklyMenuProposalMock).toHaveBeenCalledWith(21, 'discord-user-1')
    },
  },
  {
    name: 'weekly menu cancel',
    method: 'POST',
    url: '/api/internal/discord/weekly-menu-proposals/21/cancel',
    payload: { discordUserId: 'discord-user-1' },
    expectedStatus: 200,
    verify: () => {
      expect(mocks.cancelWeeklyMenuProposalMock).toHaveBeenCalledWith(21, 'discord-user-1')
    },
  },
  {
    name: 'photo analysis create',
    method: 'POST',
    url: '/api/internal/discord/photo-analysis',
    payload: {
      guildId: 'guild-1',
      channelId: 'channel-1',
      threadId: 'thread-1',
      discordUserId: 'discord-user-1',
      requestedServings: 4,
      imageUrl: 'https://example.com/images/ingredients.jpg',
    },
    expectedStatus: 201,
    verify: () => {
      expect(mocks.createPhotoAnalysisDraftMock).toHaveBeenCalledWith({
        guildId: 'guild-1',
        channelId: 'channel-1',
        threadId: 'thread-1',
        discordUserId: 'discord-user-1',
        requestedServings: 4,
        imageUrl: 'https://example.com/images/ingredients.jpg',
      })
    },
  },
  {
    name: 'photo analysis fetch',
    method: 'GET',
    url: '/api/internal/discord/photo-analysis/31',
    expectedStatus: 200,
    verify: () => {
      expect(mocks.getPhotoAnalysisDraftByIdMock).toHaveBeenCalledWith(31)
    },
  },
  {
    name: 'photo analysis patch',
    method: 'PATCH',
    url: '/api/internal/discord/photo-analysis/31',
    payload: {
      discordUserId: 'discord-user-1',
      ingredients: ['卵', 'トマト'],
      excludeRecipeIds: [91],
    },
    expectedStatus: 200,
    verify: () => {
      expect(mocks.updatePhotoAnalysisDraftMock).toHaveBeenCalledWith(31, {
        discordUserId: 'discord-user-1',
        ingredients: ['卵', 'トマト'],
        excludeRecipeIds: [91],
      })
    },
  },
  {
    name: 'photo analysis select',
    method: 'POST',
    url: '/api/internal/discord/photo-analysis/31/select',
    payload: { discordUserId: 'discord-user-1', recipeId: 91 },
    expectedStatus: 200,
    verify: () => {
      expect(mocks.selectPhotoCandidateMock).toHaveBeenCalledWith(31, 'discord-user-1', 91)
    },
  },
  {
    name: 'photo analysis cancel',
    method: 'POST',
    url: '/api/internal/discord/photo-analysis/31/cancel',
    payload: { discordUserId: 'discord-user-1' },
    expectedStatus: 200,
    verify: () => {
      expect(mocks.cancelPhotoAnalysisDraftMock).toHaveBeenCalledWith(31, 'discord-user-1')
    },
  },
  {
    name: 'kitchen advice create',
    method: 'POST',
    url: '/api/internal/discord/kitchen-advice',
    payload: {
      guildId: 'guild-1',
      channelId: 'channel-1',
      threadId: 'thread-1',
      discordUserId: 'discord-user-1',
      requestedServings: 4,
      question: 'カレーをおいしく作るコツは？',
    },
    expectedStatus: 201,
    verify: () => {
      expect(mocks.createKitchenAdviceSessionMock).toHaveBeenCalledWith({
        guildId: 'guild-1',
        channelId: 'channel-1',
        threadId: 'thread-1',
        discordUserId: 'discord-user-1',
        requestedServings: 4,
        question: 'カレーをおいしく作るコツは？',
      })
    },
  },
  {
    name: 'kitchen advice fetch',
    method: 'GET',
    url: '/api/internal/discord/kitchen-advice/41',
    expectedStatus: 200,
    verify: () => {
      expect(mocks.getKitchenAdviceSessionByIdMock).toHaveBeenCalledWith(41)
    },
  },
  {
    name: 'kitchen advice follow up',
    method: 'POST',
    url: '/api/internal/discord/kitchen-advice/41/follow-up',
    payload: { discordUserId: 'discord-user-1', prompt: 'もっと時短寄りで教えて' },
    expectedStatus: 200,
    verify: () => {
      expect(mocks.followUpKitchenAdviceSessionMock).toHaveBeenCalledWith(41, {
        discordUserId: 'discord-user-1',
        prompt: 'もっと時短寄りで教えて',
      })
    },
  },
  {
    name: 'kitchen advice cancel',
    method: 'POST',
    url: '/api/internal/discord/kitchen-advice/41/cancel',
    payload: { discordUserId: 'discord-user-1' },
    expectedStatus: 200,
    verify: () => {
      expect(mocks.cancelKitchenAdviceSessionMock).toHaveBeenCalledWith(41, 'discord-user-1')
    },
  },
]

describe('registerInternalDiscordRoutes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    process.env['DISCORD_INTERNAL_API_TOKEN'] = AUTH_TOKEN
    resetServiceMocks()
    app = await buildApp()
  })

  afterEach(async () => {
    delete process.env['DISCORD_INTERNAL_API_TOKEN']
    await app.close()
  })

  describe.each(endpointCases)('$name', (endpointCase) => {
    it('rejects unauthorized requests', async () => {
      const response = await app.inject(injectOptions(endpointCase))

      expect(response.statusCode).toBe(401)
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error: 'Unauthorized',
      })
    })

    it('dispatches authorized requests to the correct service', async () => {
      const response = await app.inject(injectOptions(endpointCase, true))

      expect(response.statusCode).toBe(endpointCase.expectedStatus)
      expect(JSON.parse(response.body).success).toBe(true)
      endpointCase.verify()
    })
  })

  it('returns 500 when the internal token is not configured', async () => {
    delete process.env['DISCORD_INTERNAL_API_TOKEN']

    const response = await app.inject({
      method: 'GET',
      url: '/api/internal/discord/channel-bindings/recipe_import?guildId=guild-1',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(500)
    expect(JSON.parse(response.body)).toEqual({
      success: false,
      error: 'DISCORD_INTERNAL_API_TOKEN is not configured',
    })
  })

  it('rejects unknown workflows with 400', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/internal/discord/channel-bindings/not_a_workflow',
      headers: authHeaders(),
      payload: { guildId: 'guild-1', channelId: 'channel-1' },
    })

    expect(response.statusCode).toBe(400)
    expect(mocks.bindDiscordWorkflowChannelMock).not.toHaveBeenCalled()
  })

  it('rejects recipe import patches with unknown fields', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/internal/discord/recipe-imports/11',
      headers: authHeaders(),
      payload: {
        discordUserId: 'discord-user-1',
        patch: { title: 'updated title', unexpectedField: true },
      },
    })

    expect(response.statusCode).toBe(400)
    expect(mocks.updateRecipeImportDraftMock).not.toHaveBeenCalled()
  })

  it('rejects invalid photo analysis URLs', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/internal/discord/photo-analysis',
      headers: authHeaders(),
      payload: {
        guildId: 'guild-1',
        channelId: 'channel-1',
        discordUserId: 'discord-user-1',
        requestedServings: 4,
        imageUrl: 'not-a-url',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(mocks.createPhotoAnalysisDraftMock).not.toHaveBeenCalled()
  })

  it('rejects empty kitchen advice follow-up prompts', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/internal/discord/kitchen-advice/41/follow-up',
      headers: authHeaders(),
      payload: {
        discordUserId: 'discord-user-1',
        prompt: '',
      },
    })

    expect(response.statusCode).toBe(400)
    expect(mocks.followUpKitchenAdviceSessionMock).not.toHaveBeenCalled()
  })

  it('returns 404 when a recipe import draft is missing', async () => {
    mocks.getRecipeImportDraftByIdMock.mockResolvedValueOnce(null)

    const response = await app.inject({
      method: 'GET',
      url: '/api/internal/discord/recipe-imports/999',
      headers: authHeaders(),
    })

    expect(response.statusCode).toBe(404)
    expect(JSON.parse(response.body)).toEqual({
      success: false,
      error: '下書きが見つかりません。',
    })
  })

  it('returns 409 when recipe approval detects duplicates', async () => {
    mocks.approveRecipeImportDraftMock.mockRejectedValueOnce(new Error('レシピが重複しています。'))

    const response = await app.inject({
      method: 'POST',
      url: '/api/internal/discord/recipe-imports/11/approve',
      headers: authHeaders(),
      payload: { discordUserId: 'discord-user-1' },
    })

    expect(response.statusCode).toBe(409)
    expect(JSON.parse(response.body)).toEqual({
      success: false,
      error: 'レシピが重複しています。',
    })
  })
})

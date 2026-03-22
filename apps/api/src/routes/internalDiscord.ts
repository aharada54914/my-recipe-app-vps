import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  CreateDiscordRecipeImportDraftRequestSchema,
  DiscordWorkflowSchema,
  UpdateDiscordRecipeImportDraftRequestSchema,
} from '@kitchen/shared-types'
import {
  approveRecipeImportDraft,
  bindDiscordWorkflowChannel,
  cancelRecipeImportDraft,
  createRecipeImportDraft,
  getDiscordWorkflowChannel,
  getRecipeImportDraftById,
  updateRecipeImportDraft,
} from '../lib/recipeImport/service.js'

function assertInternalDiscordAuth(request: FastifyRequest, reply: FastifyReply): boolean {
  const expected = process.env['DISCORD_INTERNAL_API_TOKEN']
  if (!expected) {
    reply.status(500).send({
      success: false,
      error: 'DISCORD_INTERNAL_API_TOKEN is not configured',
    })
    return false
  }

  const actual = request.headers['x-internal-token']
  if (actual !== expected) {
    reply.status(401).send({
      success: false,
      error: 'Unauthorized',
    })
    return false
  }

  return true
}

const ChannelBindingBodySchema = z.object({
  guildId: z.string().min(1),
  channelId: z.string().min(1),
})

const GuildQuerySchema = z.object({
  guildId: z.string().min(1),
})

const DraftParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const DraftActorBodySchema = z.object({
  discordUserId: z.string().min(1),
})

export async function registerInternalDiscordRoutes(app: FastifyInstance): Promise<void> {
  app.put('/api/internal/discord/channel-bindings/:workflow', async (request, reply) => {
    if (!assertInternalDiscordAuth(request, reply)) return

    try {
      const params = z.object({ workflow: DiscordWorkflowSchema }).parse(request.params)
      const body = ChannelBindingBodySchema.parse(request.body)

      await bindDiscordWorkflowChannel({
        guildId: body.guildId,
        workflow: params.workflow,
        channelId: body.channelId,
      })

      reply.send({ success: true, data: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      reply.status(400).send({ success: false, error: message })
    }
  })

  app.get('/api/internal/discord/channel-bindings/:workflow', async (request, reply) => {
    if (!assertInternalDiscordAuth(request, reply)) return

    try {
      const params = z.object({ workflow: DiscordWorkflowSchema }).parse(request.params)
      const query = GuildQuerySchema.parse(request.query)
      const channelId = await getDiscordWorkflowChannel({
        guildId: query.guildId,
        workflow: params.workflow,
      })

      reply.send({ success: true, data: { channelId } })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      reply.status(400).send({ success: false, error: message })
    }
  })

  app.post('/api/internal/discord/recipe-imports', async (request, reply) => {
    if (!assertInternalDiscordAuth(request, reply)) return

    try {
      const body = CreateDiscordRecipeImportDraftRequestSchema.parse(request.body)
      const draft = await createRecipeImportDraft(body)
      reply.status(201).send({ success: true, data: draft })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      reply.status(400).send({ success: false, error: message })
    }
  })

  app.get('/api/internal/discord/recipe-imports/:id', async (request, reply) => {
    if (!assertInternalDiscordAuth(request, reply)) return

    try {
      const params = DraftParamsSchema.parse(request.params)
      const draft = await getRecipeImportDraftById(params.id)
      if (!draft) {
        reply.status(404).send({ success: false, error: '下書きが見つかりません。' })
        return
      }
      reply.send({ success: true, data: draft })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      reply.status(400).send({ success: false, error: message })
    }
  })

  app.patch('/api/internal/discord/recipe-imports/:id', async (request, reply) => {
    if (!assertInternalDiscordAuth(request, reply)) return

    try {
      const params = DraftParamsSchema.parse(request.params)
      const body = z.object({
        discordUserId: z.string().min(1),
        patch: UpdateDiscordRecipeImportDraftRequestSchema,
      }).parse(request.body)

      const draft = await updateRecipeImportDraft(params.id, body.patch, body.discordUserId)
      reply.send({ success: true, data: draft })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      reply.status(400).send({ success: false, error: message })
    }
  })

  app.post('/api/internal/discord/recipe-imports/:id/approve', async (request, reply) => {
    if (!assertInternalDiscordAuth(request, reply)) return

    try {
      const params = DraftParamsSchema.parse(request.params)
      const body = DraftActorBodySchema.parse(request.body)
      const draft = await approveRecipeImportDraft(params.id, body.discordUserId)
      reply.send({ success: true, data: draft })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const statusCode = message.includes('重複しています') ? 409 : 400
      reply.status(statusCode).send({ success: false, error: message })
    }
  })

  app.post('/api/internal/discord/recipe-imports/:id/cancel', async (request, reply) => {
    if (!assertInternalDiscordAuth(request, reply)) return

    try {
      const params = DraftParamsSchema.parse(request.params)
      const body = DraftActorBodySchema.parse(request.body)
      const draft = await cancelRecipeImportDraft(params.id, body.discordUserId)
      reply.send({ success: true, data: draft })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      reply.status(400).send({ success: false, error: message })
    }
  })
}

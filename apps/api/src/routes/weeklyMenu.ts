import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.ts'
import { WeeklyMenuItemSchema, WeeklyMenuStatusSchema } from '@kitchen/shared-types'

const CreateWeeklyMenuSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(WeeklyMenuItemSchema),
  shoppingList: z.string().optional(),
  status: WeeklyMenuStatusSchema.default('draft'),
})

const UpdateWeeklyMenuSchema = z.object({
  items: z.array(WeeklyMenuItemSchema).optional(),
  shoppingList: z.string().optional(),
  status: WeeklyMenuStatusSchema.optional(),
})

export async function registerWeeklyMenuRoutes(app: FastifyInstance): Promise<void> {
  // List weekly menus for current user
  app.get('/api/weekly-menus', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.sub
      const menus = await prisma.weeklyMenu.findMany({
        where: { userId },
        orderBy: { weekStartDate: 'desc' },
        take: 12,
      })

      reply.send({ success: true, data: menus })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      reply.status(500).send({
        success: false,
        error: `Failed to fetch weekly menus: ${message}`,
      })
    }
  })

  // Get specific weekly menu
  app.get('/api/weekly-menus/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.sub
      const { id } = request.params as { id: string }

      const menu = await prisma.weeklyMenu.findFirst({
        where: { id: Number.parseInt(id, 10), userId },
      })

      if (!menu) {
        reply.status(404).send({ success: false, error: 'Weekly menu not found' })
        return
      }

      reply.send({ success: true, data: menu })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      reply.status(500).send({
        success: false,
        error: `Failed to fetch weekly menu: ${message}`,
      })
    }
  })

  // Create or update weekly menu (upsert by weekStartDate)
  app.post('/api/weekly-menus', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.sub
      const data = CreateWeeklyMenuSchema.parse(request.body)

      const menu = await prisma.weeklyMenu.upsert({
        where: {
          userId_weekStartDate: {
            userId,
            weekStartDate: data.weekStartDate,
          },
        },
        update: {
          items: data.items as unknown as Record<string, unknown>[],
          shoppingList: data.shoppingList,
          status: data.status,
        },
        create: {
          userId,
          weekStartDate: data.weekStartDate,
          items: data.items as unknown as Record<string, unknown>[],
          shoppingList: data.shoppingList,
          status: data.status,
        },
      })

      reply.status(201).send({ success: true, data: menu })
    } catch (err) {
      if (err instanceof z.ZodError) {
        reply.status(400).send({
          success: false,
          error: 'Validation error',
          data: err.errors,
        })
        return
      }
      const message = err instanceof Error ? err.message : String(err)
      reply.status(500).send({
        success: false,
        error: `Failed to create weekly menu: ${message}`,
      })
    }
  })

  // Update weekly menu
  app.put('/api/weekly-menus/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.sub
      const { id } = request.params as { id: string }
      const data = UpdateWeeklyMenuSchema.parse(request.body)

      const existing = await prisma.weeklyMenu.findFirst({
        where: { id: Number.parseInt(id, 10), userId },
      })

      if (!existing) {
        reply.status(404).send({ success: false, error: 'Weekly menu not found' })
        return
      }

      const updateData: Record<string, unknown> = {}
      if (data.items) updateData['items'] = data.items as unknown as Record<string, unknown>[]
      if (data.shoppingList !== undefined) updateData['shoppingList'] = data.shoppingList
      if (data.status) updateData['status'] = data.status

      const menu = await prisma.weeklyMenu.update({
        where: { id: Number.parseInt(id, 10) },
        data: updateData,
      })

      reply.send({ success: true, data: menu })
    } catch (err) {
      if (err instanceof z.ZodError) {
        reply.status(400).send({
          success: false,
          error: 'Validation error',
          data: err.errors,
        })
        return
      }
      const message = err instanceof Error ? err.message : String(err)
      reply.status(500).send({
        success: false,
        error: `Failed to update weekly menu: ${message}`,
      })
    }
  })
}

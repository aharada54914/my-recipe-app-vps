import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.ts'
import {
  DeviceTypeSchema,
  RecipeCategorySchema,
  IngredientSchema,
  CookingStepSchema,
  NutritionPerServingSchema,
} from '@kitchen/shared-types'

const RecipeQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: RecipeCategorySchema.optional(),
  device: DeviceTypeSchema.optional(),
  search: z.string().optional(),
})

const CreateRecipeSchema = z.object({
  title: z.string().min(1),
  recipeNumber: z.string().min(1),
  device: DeviceTypeSchema,
  category: RecipeCategorySchema,
  baseServings: z.number().int().positive().default(2),
  totalWeightG: z.number().default(0),
  totalTimeMinutes: z.number().default(30),
  ingredients: z.array(IngredientSchema).min(1),
  steps: z.array(CookingStepSchema).min(1),
  nutritionPerServing: NutritionPerServingSchema.optional(),
  imageUrl: z.string().url().optional(),
  sourceUrl: z.string().url().optional(),
  isUserAdded: z.boolean().default(false),
})

const UpdateRecipeSchema = CreateRecipeSchema.partial()

export async function registerRecipeRoutes(app: FastifyInstance): Promise<void> {
  // List recipes with pagination and filters
  app.get('/api/recipes', async (request, reply) => {
    try {
      const query = RecipeQuerySchema.parse(request.query)
      const { page, limit, category, device, search } = query
      const skip = (page - 1) * limit

      const where: Record<string, unknown> = {}
      if (category && category !== 'すべて') where['category'] = category
      if (device) where['device'] = device
      if (search) {
        where['title'] = { contains: search, mode: 'insensitive' }
      }

      const [recipes, total] = await Promise.all([
        prisma.recipe.findMany({
          where,
          skip,
          take: limit,
          orderBy: { id: 'asc' },
        }),
        prisma.recipe.count({ where }),
      ])

      reply.send({
        success: true,
        data: recipes,
        meta: { total, page, limit },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      reply.status(500).send({
        success: false,
        error: `Failed to fetch recipes: ${message}`,
      })
    }
  })

  // Get single recipe
  app.get('/api/recipes/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const recipe = await prisma.recipe.findUnique({
        where: { id: Number.parseInt(id, 10) },
      })

      if (!recipe) {
        reply.status(404).send({
          success: false,
          error: 'Recipe not found',
        })
        return
      }

      reply.send({ success: true, data: recipe })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      reply.status(500).send({
        success: false,
        error: `Failed to fetch recipe: ${message}`,
      })
    }
  })

  // Create recipe (authenticated)
  app.post('/api/recipes', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const data = CreateRecipeSchema.parse(request.body)
      const recipe = await prisma.recipe.create({
        data: {
          ...data,
          ingredients: data.ingredients as unknown as Record<string, unknown>[],
          steps: data.steps as unknown as Record<string, unknown>[],
          nutritionPerServing: data.nutritionPerServing as unknown as Record<string, unknown> | undefined,
        },
      })

      reply.status(201).send({ success: true, data: recipe })
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
        error: `Failed to create recipe: ${message}`,
      })
    }
  })

  // Update recipe (authenticated)
  app.put('/api/recipes/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const data = UpdateRecipeSchema.parse(request.body)

      const updateData: Record<string, unknown> = { ...data }
      if (data.ingredients) {
        updateData['ingredients'] = data.ingredients as unknown as Record<string, unknown>[]
      }
      if (data.steps) {
        updateData['steps'] = data.steps as unknown as Record<string, unknown>[]
      }
      if (data.nutritionPerServing) {
        updateData['nutritionPerServing'] = data.nutritionPerServing as unknown as Record<string, unknown>
      }

      const recipe = await prisma.recipe.update({
        where: { id: Number.parseInt(id, 10) },
        data: updateData,
      })

      reply.send({ success: true, data: recipe })
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
        error: `Failed to update recipe: ${message}`,
      })
    }
  })

  // Delete recipe (authenticated)
  app.delete('/api/recipes/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await prisma.recipe.delete({
        where: { id: Number.parseInt(id, 10) },
      })

      reply.send({ success: true, data: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      reply.status(500).send({
        success: false,
        error: `Failed to delete recipe: ${message}`,
      })
    }
  })
}

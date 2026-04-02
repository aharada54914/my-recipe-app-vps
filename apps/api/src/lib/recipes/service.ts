import type { InputJsonValue } from '@prisma/client/runtime/library'
import { z } from 'zod'
import { prisma } from '../../db/client.js'
import {
  type CookingStep,
  DeviceTypeSchema,
  type Ingredient,
  type NutritionPerServing,
  RecipeCategorySchema,
  IngredientSchema,
  CookingStepSchema,
  NutritionPerServingSchema,
} from '@kitchen/shared-types'

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface RecipeQuery {
  page: number
  limit: number
  category?: string
  device?: string
  search?: string
}

const CreateRecipeInputSchema = z.object({
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

export type CreateRecipeInput = z.infer<typeof CreateRecipeInputSchema>

// ---------------------------------------------------------------------------
// JSON helpers (Prisma requires InputJsonValue for Json columns)
// ---------------------------------------------------------------------------

function toJsonArray<T>(value: T[]): InputJsonValue {
  return value as InputJsonValue
}

function toJsonObject<T extends object>(value: T | undefined): InputJsonValue | undefined {
  if (value === undefined) {
    return undefined
  }
  return value as InputJsonValue
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function listRecipes(query: RecipeQuery): Promise<{
  recipes: unknown[]
  total: number
  page: number
  limit: number
}> {
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

  return { recipes, total, page, limit }
}

export async function getRecipeById(id: number): Promise<unknown | null> {
  return prisma.recipe.findUnique({ where: { id } })
}

export async function createRecipe(data: CreateRecipeInput): Promise<unknown> {
  return prisma.recipe.create({
    data: {
      ...data,
      ingredients: toJsonArray<Ingredient>(data.ingredients),
      steps: toJsonArray<CookingStep>(data.steps),
      nutritionPerServing: toJsonObject<NutritionPerServing>(data.nutritionPerServing),
    },
  })
}

export async function updateRecipe(
  id: number,
  data: Partial<CreateRecipeInput>,
): Promise<unknown> {
  const updateData: Record<string, unknown> = { ...data }
  if (data.ingredients) {
    updateData['ingredients'] = toJsonArray<Ingredient>(data.ingredients)
  }
  if (data.steps) {
    updateData['steps'] = toJsonArray<CookingStep>(data.steps)
  }
  if (data.nutritionPerServing !== undefined) {
    updateData['nutritionPerServing'] = toJsonObject<NutritionPerServing>(data.nutritionPerServing)
  }

  return prisma.recipe.update({ where: { id }, data: updateData })
}

export async function deleteRecipe(id: number): Promise<void> {
  await prisma.recipe.delete({ where: { id } })
}

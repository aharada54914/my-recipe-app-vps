import { z } from 'zod'
import { prisma } from '../db.js'

export const searchRecipesInputSchema = z.object({
  query: z.string().optional().describe('Title keyword to search for (case-insensitive partial match)'),
  category: z.string().optional().describe('Recipe category to filter by'),
  device: z.string().optional().describe('Cooking device to filter by: hotcook, healsio, or manual'),
  limit: z.number().int().min(1).max(50).default(20).describe('Maximum number of results to return'),
})

export type SearchRecipesInput = z.infer<typeof searchRecipesInputSchema>

export async function searchRecipes(input: SearchRecipesInput): Promise<string> {
  const { query, category, device, limit } = input

  const recipes = await prisma.recipe.findMany({
    where: {
      ...(query !== undefined && query !== ''
        ? { title: { contains: query, mode: 'insensitive' } }
        : {}),
      ...(category !== undefined && category !== '' ? { category } : {}),
      ...(device !== undefined && device !== '' ? { device } : {}),
    },
    take: limit,
    select: {
      id: true,
      title: true,
      device: true,
      category: true,
      recipeNumber: true,
      baseServings: true,
      totalTimeMinutes: true,
      imageUrl: true,
      sourceUrl: true,
    },
    orderBy: { id: 'asc' },
  })

  return JSON.stringify(recipes, null, 2)
}

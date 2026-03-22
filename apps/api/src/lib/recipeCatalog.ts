import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { InputJsonValue } from '@prisma/client/runtime/library'
import { z } from 'zod'
import { prisma } from '../db/client.js'

const CatalogRecipeSchema = z.object({
  title: z.string().min(1),
  recipeNumber: z.string().min(1),
  device: z.string().min(1),
  category: z.string().min(1),
  baseServings: z.number().int().positive().catch(2),
  totalWeightG: z.number().catch(0),
  totalTimeMinutes: z.number().int().positive().catch(30),
  ingredients: z.array(z.unknown()).catch([]),
  steps: z.array(z.unknown()).catch([]),
  nutritionPerServing: z.unknown().optional(),
  imageUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
})

type CatalogRecipe = z.infer<typeof CatalogRecipeSchema>

const MINIMUM_FULL_CATALOG_SIZE = 1000

function resolveCatalogDir(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url))
  return [
    path.resolve(here, '../../seed'),
    path.resolve(here, '../../../../web/public/seed'),
  ]
}

async function readCatalogFile(filePath: string): Promise<CatalogRecipe[]> {
  const raw = await readFile(filePath, 'utf8')
  const parsed = z.array(CatalogRecipeSchema).parse(JSON.parse(raw))
  return parsed
}

async function loadBundledCatalog(): Promise<CatalogRecipe[]> {
  const directories = resolveCatalogDir()
  const unique = new Map<string, CatalogRecipe>()

  for (const directory of directories) {
    for (const fileName of ['recipes-healsio.json', 'recipes-hotcook.json', 'recipes-booklet.json']) {
      const filePath = path.join(directory, fileName)
      try {
        const recipes = await readCatalogFile(filePath)
        for (const recipe of recipes) {
          unique.set(recipe.recipeNumber, recipe)
        }
      } catch {
        // Try the next fallback path.
      }
    }

    if (unique.size >= MINIMUM_FULL_CATALOG_SIZE) {
      return [...unique.values()]
    }
  }

  if (unique.size === 0) {
    throw new Error('Bundled recipe catalog is not available.')
  }

  return [...unique.values()]
}

function toJsonValue(value: unknown): InputJsonValue {
  return value as InputJsonValue
}

export async function ensureRecipeCatalogLoaded(): Promise<number> {
  const existingCount = await prisma.recipe.count()
  if (existingCount >= MINIMUM_FULL_CATALOG_SIZE) {
    return existingCount
  }

  const catalog = await loadBundledCatalog()
  await prisma.recipe.createMany({
    data: catalog.map((recipe) => ({
      title: recipe.title,
      recipeNumber: recipe.recipeNumber,
      device: recipe.device,
      category: recipe.category,
      baseServings: recipe.baseServings,
      totalWeightG: Math.round(recipe.totalWeightG ?? 0),
      totalTimeMinutes: recipe.totalTimeMinutes,
      ingredients: toJsonValue(recipe.ingredients),
      steps: toJsonValue(recipe.steps),
      ...(recipe.nutritionPerServing !== undefined ? { nutritionPerServing: toJsonValue(recipe.nutritionPerServing) } : {}),
      ...(recipe.imageUrl ? { imageUrl: recipe.imageUrl } : {}),
      ...(recipe.sourceUrl ? { sourceUrl: recipe.sourceUrl } : {}),
    })),
    skipDuplicates: true,
  })

  return prisma.recipe.count()
}

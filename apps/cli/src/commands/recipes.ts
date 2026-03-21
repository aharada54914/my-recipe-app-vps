import type { Command } from 'commander'
import { readFile } from 'node:fs/promises'
import { apiGet, apiPost } from '../lib/apiClient.js'
import type { ApiResponse, Recipe } from '@kitchen/shared-types'

interface RecipeListResponse extends ApiResponse<Recipe[]> {
  meta?: { total: number; page: number; limit: number }
}

export function registerRecipesCommands(program: Command): void {
  const recipes = program
    .command('recipes')
    .description('Recipe management')

  recipes
    .command('list')
    .description('List recipes')
    .option('-p, --page <page>', 'Page number', '1')
    .option('-l, --limit <limit>', 'Items per page', '20')
    .option('-c, --category <category>', 'Filter by category')
    .option('-d, --device <device>', 'Filter by device')
    .option('-s, --search <term>', 'Search by title')
    .action(async (options: {
      page: string
      limit: string
      category?: string
      device?: string
      search?: string
    }) => {
      try {
        const params = new URLSearchParams({
          page: options.page,
          limit: options.limit,
        })
        if (options.category) params.set('category', options.category)
        if (options.device) params.set('device', options.device)
        if (options.search) params.set('search', options.search)

        const result = await apiGet<RecipeListResponse>(
          `/api/recipes?${params.toString()}`,
        )

        if (!result.success || !result.data) {
          console.error('Failed to fetch recipes:', result.error)
          return
        }

        const total = result.meta?.total ?? result.data.length
        console.info(`Recipes (${total} total):`)
        console.info('─'.repeat(60))

        for (const recipe of result.data) {
          const id = String(recipe.id ?? '?').padStart(4)
          const device = recipe.device.padEnd(8)
          const category = recipe.category.padEnd(6)
          console.info(`  #${id}  [${device}]  [${category}]  ${recipe.title}`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Error:', message)
      }
    })

  recipes
    .command('import')
    .description('Import recipes from JSON file')
    .requiredOption('-f, --file <path>', 'JSON file path')
    .action(async (options: { file: string }) => {
      try {
        const content = await readFile(options.file, 'utf-8')
        const data = JSON.parse(content) as Recipe[]

        if (!Array.isArray(data)) {
          console.error('JSON file must contain an array of recipes')
          return
        }

        let successCount = 0
        let failCount = 0

        for (const recipe of data) {
          try {
            await apiPost<ApiResponse<Recipe>>('/api/recipes', recipe)
            successCount++
          } catch (err) {
            failCount++
            const message = err instanceof Error ? err.message : String(err)
            console.error(`  Failed to import "${recipe.title}": ${message}`)
          }
        }

        console.info(`Import complete: ${successCount} succeeded, ${failCount} failed`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Error:', message)
      }
    })

  recipes
    .command('show')
    .description('Show recipe details')
    .argument('<id>', 'Recipe ID')
    .action(async (id: string) => {
      try {
        const result = await apiGet<ApiResponse<Recipe>>(`/api/recipes/${id}`)

        if (!result.success || !result.data) {
          console.error('Recipe not found:', result.error)
          return
        }

        const r = result.data
        console.info(`Recipe #${r.id}: ${r.title}`)
        console.info('─'.repeat(50))
        console.info(`  Device:    ${r.device}`)
        console.info(`  Category:  ${r.category}`)
        console.info(`  Number:    ${r.recipeNumber}`)
        console.info(`  Servings:  ${r.baseServings}`)
        console.info(`  Time:      ${r.totalTimeMinutes} min`)
        console.info('')
        console.info('  Ingredients:')
        if (Array.isArray(r.ingredients)) {
          for (const ing of r.ingredients) {
            console.info(`    - ${ing.name}: ${ing.quantity}${ing.unit}`)
          }
        }
        console.info('')
        console.info('  Steps:')
        if (Array.isArray(r.steps)) {
          for (const [i, step] of r.steps.entries()) {
            const deviceTag = step.isDeviceStep ? ' [device]' : ''
            console.info(`    ${i + 1}. ${step.name} (${step.durationMinutes}min)${deviceTag}`)
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Error:', message)
      }
    })
}

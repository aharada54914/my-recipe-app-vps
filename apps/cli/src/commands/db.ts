import type { Command } from 'commander'
import { execSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { apiGet } from '../lib/apiClient.ts'
import type { ApiResponse, Recipe } from '@kitchen/shared-types'

export function registerDbCommands(program: Command): void {
  const db = program
    .command('db')
    .description('Database management')

  db
    .command('migrate')
    .description('Run Prisma migrations')
    .action(() => {
      try {
        console.info('Running database migrations...')
        execSync('npx prisma migrate deploy', {
          stdio: 'inherit',
          cwd: new URL('../../..', import.meta.url).pathname,
        })
        console.info('Migrations complete.')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Migration failed:', message)
      }
    })

  db
    .command('seed')
    .description('Seed database with initial data')
    .action(() => {
      try {
        console.info('Seeding database...')
        execSync('npx tsx src/db/seed.ts', {
          stdio: 'inherit',
          cwd: new URL('../../..', import.meta.url).pathname,
        })
        console.info('Seed complete.')
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Seed failed:', message)
      }
    })

  db
    .command('backup')
    .description('Export recipes to JSON')
    .option('-o, --output <file>', 'Output file path', 'backup.json')
    .action(async (options: { output: string }) => {
      try {
        console.info('Exporting recipes...')

        // Fetch all recipes (paginated)
        const allRecipes: Recipe[] = []
        let page = 1
        const limit = 100
        let hasMore = true

        while (hasMore) {
          const result = await apiGet<ApiResponse<Recipe[]> & { meta?: { total: number } }>(
            `/api/recipes?page=${page}&limit=${limit}`,
          )

          if (!result.success || !result.data) {
            console.error('Failed to fetch recipes:', result.error)
            return
          }

          allRecipes.push(...result.data)

          const total = result.meta?.total ?? 0
          hasMore = allRecipes.length < total
          page++
        }

        await writeFile(
          options.output,
          JSON.stringify(allRecipes, null, 2),
          'utf-8',
        )

        console.info(`Exported ${allRecipes.length} recipes to ${options.output}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Backup failed:', message)
      }
    })

  db
    .command('status')
    .description('Show database connection status')
    .action(async () => {
      try {
        const result = await apiGet<ApiResponse<{ status: string; database: string }>>(
          '/api/health',
        )

        if (result.success && result.data) {
          console.info(`Database: ${result.data.database}`)
          console.info(`Status: ${result.data.status}`)
        } else {
          console.error('Database status check failed:', result.error)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Cannot reach API:', message)
      }
    })
}

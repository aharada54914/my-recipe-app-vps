import type { Command } from 'commander'
import { apiGet, apiPost } from '../lib/apiClient.ts'
import type { ApiResponse, WeeklyMenu } from '@kitchen/shared-types'

export function registerMenuCommands(program: Command): void {
  const menu = program
    .command('menu')
    .description('Weekly menu management')

  menu
    .command('list')
    .description('List recent weekly menus')
    .action(async () => {
      try {
        const result = await apiGet<ApiResponse<WeeklyMenu[]>>('/api/weekly-menus')
        if (!result.success || !result.data) {
          console.error('Failed to fetch menus:', result.error)
          return
        }

        if (result.data.length === 0) {
          console.info('No weekly menus found.')
          return
        }

        console.info('Weekly Menus:')
        console.info('─'.repeat(50))
        for (const m of result.data) {
          const itemCount = Array.isArray(m.items) ? m.items.length : 0
          console.info(`  ${m.weekStartDate}  [${m.status}]  ${itemCount} items`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Error:', message)
      }
    })

  menu
    .command('send-email')
    .description('Send weekly menu email')
    .option('--all', 'Send to all users')
    .option('--user <email>', 'Send to specific user')
    .action(async (options: { all?: boolean; user?: string }) => {
      try {
        const body: Record<string, unknown> = {}
        if (options.user) body['userEmail'] = options.user
        if (options.all) body['all'] = true

        const result = await apiPost<ApiResponse<{ sent: number }>>(
          '/api/jobs/send-weekly-email',
          body,
        )

        if (result.success) {
          console.info(`Email sent successfully. (${result.data?.sent ?? 0} recipients)`)
        } else {
          console.error('Failed to send email:', result.error)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Error:', message)
      }
    })

  menu
    .command('generate')
    .description('Generate weekly menu for a user')
    .requiredOption('--user <email>', 'User email')
    .option('--week <date>', 'Week start date (YYYY-MM-DD)')
    .action(async (options: { user: string; week?: string }) => {
      try {
        const result = await apiPost<ApiResponse<WeeklyMenu>>(
          '/api/weekly-menus/generate',
          {
            userEmail: options.user,
            weekStartDate: options.week,
          },
        )

        if (result.success && result.data) {
          console.info(`Menu generated for week ${result.data.weekStartDate}`)
          const items = Array.isArray(result.data.items) ? result.data.items : []
          for (const item of items) {
            console.info(`  ${item.date}: Recipe #${item.recipeId}`)
          }
        } else {
          console.error('Failed to generate menu:', result.error)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Error:', message)
      }
    })
}

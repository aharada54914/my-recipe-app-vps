import type { Command } from 'commander'
import { apiGet, apiPost } from '../lib/apiClient.js'
import type { ApiResponse } from '@kitchen/shared-types'

export function registerJobsCommands(program: Command): void {
  const jobs = program
    .command('jobs')
    .description('Background job management')

  jobs
    .command('status')
    .description('Show status of scheduled jobs')
    .action(async () => {
      try {
        const result = await apiGet<ApiResponse<{
          jobs: Array<{ name: string; schedule: string; lastRun?: string; status: string }>
        }>>('/api/jobs/status')

        if (!result.success || !result.data) {
          console.error('Failed to fetch job status:', result.error)
          return
        }

        console.info('Scheduled Jobs:')
        console.info('─'.repeat(60))
        for (const job of result.data.jobs) {
          const lastRun = job.lastRun ?? 'never'
          console.info(`  ${job.name.padEnd(20)} [${job.status}]  Schedule: ${job.schedule}  Last: ${lastRun}`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Error:', message)
      }
    })

  jobs
    .command('run')
    .description('Manually trigger a job')
    .argument('<jobName>', 'Job name (e.g., weekly-email)')
    .action(async (jobName: string) => {
      try {
        console.info(`Triggering job: ${jobName}...`)

        const result = await apiPost<ApiResponse<{ triggered: boolean; message: string }>>(
          `/api/jobs/run/${jobName}`,
          {},
        )

        if (result.success && result.data) {
          console.info(`Job triggered: ${result.data.message}`)
        } else {
          console.error('Failed to trigger job:', result.error)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Error:', message)
      }
    })
}

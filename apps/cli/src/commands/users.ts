import type { Command } from 'commander'
import { apiGet } from '../lib/apiClient.ts'
import type { ApiResponse } from '@kitchen/shared-types'

interface UserInfo {
  id: string
  email: string
  name: string | null
  createdAt: string
}

export function registerUsersCommands(program: Command): void {
  const users = program
    .command('users')
    .description('User management')

  users
    .command('me')
    .description('Show current authenticated user')
    .action(async () => {
      try {
        const result = await apiGet<ApiResponse<UserInfo>>('/api/auth/me')

        if (!result.success || !result.data) {
          console.error('Not authenticated or user not found:', result.error)
          return
        }

        const u = result.data
        console.info('Current User:')
        console.info('─'.repeat(40))
        console.info(`  ID:      ${u.id}`)
        console.info(`  Email:   ${u.email}`)
        console.info(`  Name:    ${u.name ?? '(not set)'}`)
        console.info(`  Created: ${u.createdAt}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Error:', message)
      }
    })

  users
    .command('health')
    .description('Check API server health')
    .action(async () => {
      try {
        const result = await apiGet<ApiResponse<{ status: string; database: string }>>(
          '/api/health',
        )

        if (result.success && result.data) {
          console.info(`Status: ${result.data.status}`)
          console.info(`Database: ${result.data.database}`)
        } else {
          console.error('Health check failed:', result.error)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Cannot reach API server:', message)
      }
    })
}

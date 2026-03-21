import type { Command } from 'commander'
import { apiGet } from '../lib/apiClient.js'
import type { ApiResponse } from '@kitchen/shared-types'
import {
  editUserPreferencesInEditor,
  formatPreferencesForDisplay,
  getUserPreferences,
  listEditablePreferenceKeys,
  resetUserPreferences,
  setUserPreference,
  type UserIdentifier,
} from '../lib/preferences.js'

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

  const prefs = users
    .command('prefs')
    .description('Manage server-backed user preferences')

  prefs
    .command('keys')
    .description('List editable preference keys')
    .action(() => {
      console.info('Editable preference keys:')
      for (const key of listEditablePreferenceKeys()) {
        console.info(`  - ${key}`)
      }
    })

  prefs
    .command('get')
    .description('Show preferences for a user')
    .option('--user <email>', 'User email')
    .option('--id <googleSub>', 'Google user sub')
    .option('--json', 'Print JSON only')
    .action(async (options: { user?: string; id?: string; json?: boolean }) => {
      try {
        const { user, preferences } = await getUserPreferences(toUserIdentifier(options))

        if (!options.json) {
          console.info(`User: ${user.email} (${user.id})`)
          if (user.name) console.info(`Name: ${user.name}`)
        }

        console.info(formatPreferencesForDisplay(preferences))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Failed to load preferences:', message)
      }
    })

  prefs
    .command('set')
    .description('Set a single preference key for a user')
    .requiredOption('--key <key>', 'Preference key')
    .requiredOption('--value <value>', 'Preference value')
    .option('--user <email>', 'User email')
    .option('--id <googleSub>', 'Google user sub')
    .action(async (options: { key: string; value: string; user?: string; id?: string }) => {
      try {
        const nextPreferences = await setUserPreference(
          toUserIdentifier(options),
          options.key as ReturnType<typeof listEditablePreferenceKeys>[number],
          options.value,
        )
        console.info(`Updated ${options.key}.`)
        console.info(formatPreferencesForDisplay(nextPreferences))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Failed to update preference:', message)
      }
    })

  prefs
    .command('reset')
    .description('Reset preferences to defaults for a user')
    .option('--user <email>', 'User email')
    .option('--id <googleSub>', 'Google user sub')
    .action(async (options: { user?: string; id?: string }) => {
      try {
        const nextPreferences = await resetUserPreferences(toUserIdentifier(options))
        console.info('Preferences reset to defaults.')
        console.info(formatPreferencesForDisplay(nextPreferences))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Failed to reset preferences:', message)
      }
    })

  prefs
    .command('edit')
    .description('Open preferences JSON in $EDITOR and save validated changes')
    .option('--user <email>', 'User email')
    .option('--id <googleSub>', 'Google user sub')
    .action(async (options: { user?: string; id?: string }) => {
      try {
        const nextPreferences = await editUserPreferencesInEditor(toUserIdentifier(options))
        console.info('Preferences updated from editor.')
        console.info(formatPreferencesForDisplay(nextPreferences))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('Failed to edit preferences:', message)
      }
    })
}

function toUserIdentifier(options: { user?: string; id?: string }): UserIdentifier {
  return {
    email: options.user,
    id: options.id,
  }
}

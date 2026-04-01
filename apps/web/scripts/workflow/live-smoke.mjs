import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../..')

async function main() {
  const [
    sharedTypesDist,
    appTsx,
    integrationStatus,
    qaGoogleMode,
    weeklyMenuSmoke,
    connectedGoogleSmoke,
    helpSource,
  ] = await Promise.all([
    readFile(path.join(repoRoot, 'packages/shared-types/dist/index.js'), 'utf8'),
    readFile(path.join(repoRoot, 'apps/web/src/App.tsx'), 'utf8'),
    readFile(path.join(repoRoot, 'apps/web/src/lib/integrationStatus.ts'), 'utf8'),
    readFile(path.join(repoRoot, 'apps/web/src/lib/qaGoogleMode.ts'), 'utf8'),
    readFile(path.join(repoRoot, 'apps/web/tests/smoke/weekly-menu-core.spec.ts'), 'utf8'),
    readFile(path.join(repoRoot, 'apps/web/tests/smoke/connected-google.spec.ts'), 'utf8'),
    readFile(path.join(repoRoot, 'apps/discord-bot/src/lib/help.ts'), 'utf8'),
  ])

  if (!sharedTypesDist.includes('WeeklyMenuPresetSchema') || !sharedTypesDist.includes('PhotoStockSaveItemSchema')) {
    throw new Error('Required shared schemas are unavailable in dist output')
  }
  if (!appTsx.includes('syncQaGoogleModeFromUrl')) {
    throw new Error('App.tsx no longer syncs QA Google mode from URL')
  }
  if (!integrationStatus.includes('getGoogleIntegrationStatus') || !integrationStatus.includes('getCalendarIntegrationStatus')) {
    throw new Error('integrationStatus helpers are unavailable')
  }
  if (!qaGoogleMode.includes('isQaGoogleModeEnabled') || !qaGoogleMode.includes('syncQaGoogleModeFromUrl')) {
    throw new Error('qaGoogleMode helpers are unavailable')
  }
  if (!weeklyMenuSmoke.includes('weekly menu generation creates and persists summary and 7 day cards')) {
    throw new Error('Weekly menu smoke spec is unavailable')
  }
  if (!connectedGoogleSmoke.includes('qa google mode exercises connected account and calendar flows')) {
    throw new Error('Connected Google smoke spec is unavailable')
  }
  if (!helpSource.includes("setName('help')") || !helpSource.includes("setName('sync-help')")) {
    throw new Error('Discord help commands are unavailable')
  }

  console.log(JSON.stringify({
    status: 'green',
    imported: [
      '@kitchen/shared-types',
      'integrationStatus',
      'qaGoogleMode',
      'weekly-menu-core.spec.ts',
      'connected-google.spec.ts',
      'discord help module',
    ],
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: 'red',
    error: error instanceof Error ? error.message : String(error),
  }, null, 2))
  process.exitCode = 1
})

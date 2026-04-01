import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../../../..')

async function readUtf8(relativePath) {
  return readFile(path.join(repoRoot, relativePath), 'utf8')
}

function assertContains(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(message)
  }
}

async function main() {
  const [agents, webPackage, appTsx, discordHelp] = await Promise.all([
    readUtf8('AGENTS.md'),
    readUtf8('apps/web/package.json'),
    readUtf8('apps/web/src/App.tsx'),
    readUtf8('apps/discord-bot/src/lib/help.ts'),
  ])

  const packageJson = JSON.parse(webPackage)
  const scripts = packageJson.scripts ?? {}
  const requiredScripts = ['test', 'test:smoke:ci', 'workflow:validate', 'workflow:smoke']
  for (const scriptName of requiredScripts) {
    if (typeof scripts[scriptName] !== 'string' || scripts[scriptName].length === 0) {
      throw new Error(`Missing required apps/web script: ${scriptName}`)
    }
  }

  assertContains(agents, 'workflow:validate', 'AGENTS.md must document workflow:validate')
  assertContains(agents, 'workflow:smoke', 'AGENTS.md must document workflow:smoke')

  const requiredRoutes = [
    { label: '/search', needle: 'path="search"' },
    { label: '/stock', needle: 'path="stock"' },
    { label: '/settings/*', needle: 'path="/settings/*"' },
    { label: '/weekly-menu', needle: 'path="weekly-menu"' },
  ]
  for (const route of requiredRoutes) {
    assertContains(appTsx, route.needle, `App.tsx is missing route ${route.label}`)
  }

  const requiredHelpTopics = ['recipe-import', 'weekly-menu', 'stock-photo', 'kitchen-advice', 'how-to-use']
  for (const topic of requiredHelpTopics) {
    assertContains(discordHelp, topic, `Discord help registry is missing ${topic}`)
  }

  console.log(JSON.stringify({
    status: 'green',
    checks: {
      agentsDocumented: true,
      scriptsPresent: requiredScripts,
      routesVerified: requiredRoutes.map((route) => route.label),
      discordHelpTopics: requiredHelpTopics,
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: 'red',
    error: error instanceof Error ? error.message : String(error),
  }, null, 2))
  process.exitCode = 1
})

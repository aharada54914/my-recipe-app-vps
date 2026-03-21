import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

export function loadRuntimeEnv(): void {
  const envPath = findEnvFile(process.cwd())
  if (!envPath) return

  const raw = readFileSync(envPath, 'utf8')

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    if (!key || process.env[key] != null) continue

    const value = stripWrappingQuotes(trimmed.slice(separatorIndex + 1).trim())
    process.env[key] = value
  }

  const databaseUrl = process.env['DATABASE_URL']
  if (!databaseUrl) return

  try {
    const parsed = new URL(databaseUrl)
    if (parsed.hostname === 'postgres') {
      parsed.hostname = '127.0.0.1'
      process.env['DATABASE_URL'] = parsed.toString()
    }
  } catch {
    // Keep the original value if it is not a standard URL.
  }
}

function findEnvFile(startDirectory: string): string | null {
  let currentDirectory = resolve(startDirectory)

  while (true) {
    const candidate = join(currentDirectory, '.env')
    if (existsSync(candidate)) return candidate

    const parentDirectory = dirname(currentDirectory)
    if (parentDirectory === currentDirectory) return null
    currentDirectory = parentDirectory
  }
}

function stripWrappingQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

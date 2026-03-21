import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(process.cwd(), 'src')
const FILE_PATTERN = /\.(css|html|ts|tsx)$/
const PATTERNS = [
  'bg-white/5',
  'bg-white/10',
  'bg-white/15',
  'ring-white/10',
  'ring-white/15',
  'backdrop-blur',
  'liquid-background',
]

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return walk(fullPath)
    }
    if (entry.isFile() && FILE_PATTERN.test(entry.name)) {
      return [fullPath]
    }
    return []
  }))
  return files.flat()
}

function countMatches(text, token) {
  return text.split(token).length - 1
}

async function main() {
  const files = await walk(ROOT)
  const counts = Object.fromEntries(PATTERNS.map((pattern) => [pattern, 0]))

  await Promise.all(files.map(async (file) => {
    const text = await fs.readFile(file, 'utf8')
    for (const pattern of PATTERNS) {
      counts[pattern] += countMatches(text, pattern)
    }
  }))

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(counts, null, 2))
    return
  }

  console.log('UI class audit')
  for (const pattern of PATTERNS) {
    console.log(`${pattern.padEnd(18)} ${String(counts[pattern]).padStart(4)}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

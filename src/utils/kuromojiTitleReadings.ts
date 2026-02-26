import { normalizeJaText } from './jaText'

type KuromojiTokenizer = import('kuromoji').Tokenizer<import('kuromoji').IpadicFeatures>

let tokenizer: KuromojiTokenizer | null = null
let loadingPromise: Promise<void> | null = null
let tokenizerVersion = 0

function getDictionaryPath(): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base.replace(/\/?$/, '/')}kuromoji-dict/`
}

function normalizeReadingToken(surface: string, reading?: string): string {
  if (reading && reading !== '*') return normalizeJaText(reading)
  return normalizeJaText(surface)
}

async function initKuromoji(): Promise<void> {
  if (tokenizer || loadingPromise) return loadingPromise ?? Promise.resolve()
  if (typeof window === 'undefined') return
  if (import.meta.env.MODE === 'test') return

  loadingPromise = (async () => {
    try {
      const kuromoji = await import('kuromoji')
      tokenizer = await new Promise<KuromojiTokenizer>((resolve, reject) => {
        kuromoji.builder({ dicPath: getDictionaryPath() }).build((err, built) => {
          if (err || !built) {
            reject(err ?? new Error('kuromoji tokenizer build failed'))
            return
          }
          resolve(built)
        })
      })
      tokenizerVersion += 1
    } catch (error) {
      console.warn('kuromoji initialization failed; fallback search remains active', error)
    } finally {
      loadingPromise = null
    }
  })()

  return loadingPromise
}

export function warmupKuromojiTitleReadings(): void {
  void initKuromoji()
}

export function getKuromojiTokenizerVersion(): number {
  return tokenizerVersion
}

export function getTitleReadingVariantsByKuromoji(text: string): string[] {
  if (!tokenizer || !text.trim()) return []

  const tokens = tokenizer.tokenize(text)
  if (!Array.isArray(tokens) || tokens.length === 0) return []

  const readingJoined = tokens
    .map((t) => normalizeReadingToken(t.surface_form ?? '', t.reading))
    .join('')
    .trim()

  if (!readingJoined || readingJoined === normalizeJaText(text)) return []

  return [readingJoined]
}

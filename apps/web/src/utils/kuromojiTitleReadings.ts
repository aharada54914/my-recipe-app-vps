import { normalizeJaText } from './jaText'
import type { IpadicFeatures, Tokenizer } from 'kuromoji'
import KuromojiTokenizerCtor from 'kuromoji/src/Tokenizer.js'
import DynamicDictionaries from 'kuromoji/src/dict/DynamicDictionaries.js'

type KuromojiTokenizer = Tokenizer<IpadicFeatures>

const DICTIONARY_FILES = {
  trie: ['base.dat.gz', 'check.dat.gz'] as const,
  tokenInfo: ['tid.dat.gz', 'tid_pos.dat.gz', 'tid_map.dat.gz'] as const,
  connection: 'cc.dat.gz' as const,
  unknown: ['unk.dat.gz', 'unk_pos.dat.gz', 'unk_map.dat.gz', 'unk_char.dat.gz', 'unk_compat.dat.gz', 'unk_invoke.dat.gz'] as const,
}

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

function isGzipBuffer(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer)
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
}

async function decodeDictionaryBuffer(response: Response): Promise<ArrayBuffer> {
  const buffer = await response.arrayBuffer()
  if (!isGzipBuffer(buffer)) return buffer
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream is unavailable for gzip dictionary decode')
  }

  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).arrayBuffer()
}

async function loadDictionaryFile(basePath: string, fileName: string): Promise<ArrayBuffer> {
  const response = await fetch(`${basePath}${fileName}`, { headers: { Accept: 'application/octet-stream' } })
  if (!response.ok) {
    throw new Error(`Failed to load kuromoji dictionary: ${fileName} (${response.status})`)
  }
  return decodeDictionaryBuffer(response)
}

async function buildTokenizer(): Promise<KuromojiTokenizer> {
  const basePath = getDictionaryPath()
  const dictionaries = new DynamicDictionaries()

  const [trieBuffers, tokenInfoBuffers, connectionBuffer, unknownBuffers] = await Promise.all([
    Promise.all(DICTIONARY_FILES.trie.map((fileName) => loadDictionaryFile(basePath, fileName))),
    Promise.all(DICTIONARY_FILES.tokenInfo.map((fileName) => loadDictionaryFile(basePath, fileName))),
    loadDictionaryFile(basePath, DICTIONARY_FILES.connection),
    Promise.all(DICTIONARY_FILES.unknown.map((fileName) => loadDictionaryFile(basePath, fileName))),
  ])

  dictionaries.loadTrie(
    new Int32Array(trieBuffers[0]),
    new Int32Array(trieBuffers[1]),
  )
  dictionaries.loadTokenInfoDictionaries(
    new Uint8Array(tokenInfoBuffers[0]),
    new Uint8Array(tokenInfoBuffers[1]),
    new Uint8Array(tokenInfoBuffers[2]),
  )
  dictionaries.loadConnectionCosts(new Int16Array(connectionBuffer))
  dictionaries.loadUnknownDictionaries(
    new Uint8Array(unknownBuffers[0]),
    new Uint8Array(unknownBuffers[1]),
    new Uint8Array(unknownBuffers[2]),
    new Uint8Array(unknownBuffers[3]),
    new Uint32Array(unknownBuffers[4]),
    new Uint8Array(unknownBuffers[5]),
  )

  return new KuromojiTokenizerCtor(dictionaries)
}

async function initKuromoji(): Promise<void> {
  if (tokenizer || loadingPromise) return loadingPromise ?? Promise.resolve()
  if (typeof window === 'undefined') return
  if (import.meta.env.MODE === 'test') return

  loadingPromise = buildTokenizer()
    .then((builtTokenizer) => {
      tokenizer = builtTokenizer
      tokenizerVersion += 1
    })
    .catch((error) => {
      console.warn('kuromoji initialization failed; fallback search remains active', error)
    })
    .finally(() => {
      loadingPromise = null
    })

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
    .map((token) => normalizeReadingToken(token.surface_form ?? '', token.reading))
    .join('')
    .trim()

  if (!readingJoined || readingJoined === normalizeJaText(text)) return []

  return [readingJoined]
}

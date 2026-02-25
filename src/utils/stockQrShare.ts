import type { StockItem } from '../db/db'

const QR_SHARE_VERSION = 1
const MAX_CHUNK_LENGTH = 850

export interface StockShareChunk {
  v: 1
  session: string
  index: number
  total: number
  crc32: string
  payload: string
}

export interface StockShareEnvelope {
  version: 1
  exportedAt: string
  stock: Array<Pick<StockItem, 'name' | 'inStock' | 'quantity' | 'unit'>>
}

export function buildStockShareChunks(stock: StockItem[], maxChunkLength = MAX_CHUNK_LENGTH): string[] {
  const normalizedStock = stock
    .map((item) => ({
      name: item.name,
      inStock: Boolean(item.inStock),
      quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
      unit: item.unit ?? undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))

  const envelope: StockShareEnvelope = {
    version: QR_SHARE_VERSION,
    exportedAt: new Date().toISOString(),
    stock: normalizedStock,
  }

  const serialized = JSON.stringify(envelope)
  const base64Payload = encodeBase64Url(serialized)
  const crc32 = toHexCrc32(base64Payload)
  const session = randomSessionId()
  const payloadChunks = chunkString(base64Payload, maxChunkLength)

  return payloadChunks.map((payload, i) => {
    const chunk: StockShareChunk = {
      v: 1,
      session,
      index: i + 1,
      total: payloadChunks.length,
      crc32,
      payload,
    }
    return JSON.stringify(chunk)
  })
}

export function decodeStockShareChunks(serializedChunks: string[]): StockShareEnvelope {
  if (serializedChunks.length === 0) throw new Error('共有データが空です')

  const parsed = serializedChunks.map(parseChunk)
  const first = parsed[0]

  const mismatched = parsed.find((chunk) => (
    chunk.session !== first.session
    || chunk.total !== first.total
    || chunk.crc32 !== first.crc32
    || chunk.v !== 1
  ))
  if (mismatched) throw new Error('別セッションのQRが混在しています')

  const uniqueByIndex = new Map<number, StockShareChunk>()
  for (const chunk of parsed) uniqueByIndex.set(chunk.index, chunk)

  if (uniqueByIndex.size !== first.total) {
    const missing: number[] = []
    for (let i = 1; i <= first.total; i += 1) {
      if (!uniqueByIndex.has(i)) missing.push(i)
    }
    throw new Error(`QRが不足しています（未受信: ${missing.join(', ')}）`)
  }

  const payload = Array.from(uniqueByIndex.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, chunk]) => chunk.payload)
    .join('')

  if (toHexCrc32(payload) !== first.crc32) {
    throw new Error('QRデータの整合性チェックに失敗しました。再スキャンしてください。')
  }

  const decoded = decodeBase64Url(payload)
  const envelope = JSON.parse(decoded) as Partial<StockShareEnvelope>

  if (envelope.version !== 1 || !Array.isArray(envelope.stock)) {
    throw new Error('共有データの形式が不正です')
  }

  const stock = envelope.stock
    .filter((s): s is Pick<StockItem, 'name' | 'inStock' | 'quantity' | 'unit'> => Boolean(s && typeof s.name === 'string'))
    .map((s) => ({
      name: s.name.trim(),
      inStock: Boolean(s.inStock),
      quantity: typeof s.quantity === 'number' ? s.quantity : undefined,
      unit: typeof s.unit === 'string' ? s.unit : undefined,
    }))
    .filter((s) => s.name.length > 0)

  return {
    version: 1,
    exportedAt: typeof envelope.exportedAt === 'string' ? envelope.exportedAt : new Date().toISOString(),
    stock,
  }
}

export function parseChunk(input: string): StockShareChunk {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    throw new Error('QRチャンクの形式が不正です')
  }

  const chunk = parsed as Partial<StockShareChunk>
  if (
    chunk.v !== 1
    || typeof chunk.session !== 'string'
    || typeof chunk.index !== 'number'
    || typeof chunk.total !== 'number'
    || typeof chunk.crc32 !== 'string'
    || typeof chunk.payload !== 'string'
  ) {
    throw new Error('QRチャンクの必須項目が不足しています')
  }

  return chunk as StockShareChunk
}

function chunkString(input: string, size: number): string[] {
  const chunks: string[] = []
  for (let i = 0; i < input.length; i += size) chunks.push(input.slice(i, i + size))
  return chunks.length > 0 ? chunks : ['']
}

function randomSessionId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function encodeBase64Url(text: string): string {
  const utf8 = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of utf8) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function toHexCrc32(input: string): string {
  const table = getCrc32Table()
  let crc = 0 ^ (-1)

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    crc = (crc >>> 8) ^ table[(crc ^ code) & 0xFF]
  }

  return ((crc ^ (-1)) >>> 0).toString(16).padStart(8, '0')
}

let crc32Table: number[] | undefined

function getCrc32Table(): number[] {
  if (crc32Table) return crc32Table
  const table: number[] = []
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c >>> 0
  }
  crc32Table = table
  return table
}

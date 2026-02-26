const LEGACY_PLAINTEXT_KEY = 'gemini_api_key'
const ENCRYPTED_KEY_STORAGE = 'gemini_api_key_encrypted_v1'

type EncryptedGeminiKeyPayload = {
  version: 1
  kdf: 'PBKDF2'
  iterations: number
  hash: 'SHA-256'
  saltB64: string
  ivB64: string
  cipherB64: string
}

let cachedDecryptedGeminiApiKey: string | null = null

function getCryptoOrThrow(): Crypto {
  const c = globalThis.crypto
  if (!c?.subtle) throw new Error('この環境ではWebCryptoが利用できません')
  return c
}

function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveAesKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const cryptoApi = getCryptoOrThrow()
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    toArrayBuffer(encodeUtf8(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function hasEncryptedGeminiApiKey(): boolean {
  try {
    return !!localStorage.getItem(ENCRYPTED_KEY_STORAGE)
  } catch {
    return false
  }
}

export function hasLegacyPlaintextGeminiApiKey(): boolean {
  try {
    return !!localStorage.getItem(LEGACY_PLAINTEXT_KEY)
  } catch {
    return false
  }
}

export function getLegacyPlaintextGeminiApiKey(): string | null {
  try {
    const raw = localStorage.getItem(LEGACY_PLAINTEXT_KEY)
    return raw?.trim() ? raw.trim() : null
  } catch {
    return null
  }
}

export async function saveEncryptedGeminiApiKey(apiKey: string, passphrase: string): Promise<void> {
  const normalizedKey = apiKey.trim()
  const normalizedPassphrase = passphrase.trim()
  if (!normalizedKey) throw new Error('APIキーが空です')
  if (normalizedPassphrase.length < 8) throw new Error('パスフレーズは8文字以上にしてください')

  const cryptoApi = getCryptoOrThrow()
  const salt = cryptoApi.getRandomValues(new Uint8Array(16))
  const iv = cryptoApi.getRandomValues(new Uint8Array(12))
  const iterations = 210000
  const aesKey = await deriveAesKey(normalizedPassphrase, salt, iterations)

  const cipherBuffer = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    toArrayBuffer(encodeUtf8(normalizedKey)),
  )

  const payload: EncryptedGeminiKeyPayload = {
    version: 1,
    kdf: 'PBKDF2',
    iterations,
    hash: 'SHA-256',
    saltB64: toBase64(salt),
    ivB64: toBase64(iv),
    cipherB64: toBase64(new Uint8Array(cipherBuffer)),
  }

  localStorage.setItem(ENCRYPTED_KEY_STORAGE, JSON.stringify(payload))
  localStorage.removeItem(LEGACY_PLAINTEXT_KEY)
  cachedDecryptedGeminiApiKey = normalizedKey
}

export async function unlockEncryptedGeminiApiKey(passphrase: string): Promise<string> {
  const normalizedPassphrase = passphrase.trim()
  if (!normalizedPassphrase) throw new Error('パスフレーズを入力してください')

  let payload: EncryptedGeminiKeyPayload | null = null
  try {
    const raw = localStorage.getItem(ENCRYPTED_KEY_STORAGE)
    if (!raw) throw new Error('暗号化されたAPIキーは保存されていません')
    payload = JSON.parse(raw) as EncryptedGeminiKeyPayload
  } catch {
    throw new Error('暗号化されたAPIキーの読み込みに失敗しました')
  }
  if (!payload || payload.version !== 1) throw new Error('未対応の暗号化データ形式です')

  const aesKey = await deriveAesKey(
    normalizedPassphrase,
    fromBase64(payload.saltB64),
    payload.iterations,
  )

  try {
    const plainBuffer = await getCryptoOrThrow().subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(fromBase64(payload.ivB64)) },
      aesKey,
      toArrayBuffer(fromBase64(payload.cipherB64)),
    )
    const apiKey = decodeUtf8(new Uint8Array(plainBuffer)).trim()
    if (!apiKey) throw new Error('復号結果が空です')
    cachedDecryptedGeminiApiKey = apiKey
    return apiKey
  } catch {
    throw new Error('パスフレーズが違うか、保存データが破損しています')
  }
}

export function getCachedGeminiApiKey(): string | null {
  return cachedDecryptedGeminiApiKey
}

export function cacheGeminiApiKeyForSession(apiKey: string | null): void {
  cachedDecryptedGeminiApiKey = apiKey?.trim() || null
}

export function clearGeminiApiKeyCache(): void {
  cachedDecryptedGeminiApiKey = null
}

export function clearStoredGeminiApiKey(): void {
  try {
    localStorage.removeItem(LEGACY_PLAINTEXT_KEY)
    localStorage.removeItem(ENCRYPTED_KEY_STORAGE)
  } catch {
    // ignore storage errors
  }
  clearGeminiApiKeyCache()
}

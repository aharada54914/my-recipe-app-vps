import type { WeeklyMenuItem } from '../db/db'

interface WeeklyMenuSharePayload {
  v: 1
  weekStartDate: string
  items: WeeklyMenuItem[]
  generatedAt: string
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

function assertItems(items: unknown): asserts items is WeeklyMenuItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('共有データの献立が不正です')
  }
  for (const item of items) {
    if (typeof item !== 'object' || item == null) throw new Error('共有データ形式が不正です')
    const row = item as Partial<WeeklyMenuItem>
    if (typeof row.recipeId !== 'number' || typeof row.date !== 'string') {
      throw new Error('共有データの必須項目が不足しています')
    }
  }
}

export function createWeeklyMenuShareCode(weekStartDate: string, items: WeeklyMenuItem[]): string {
  const payload: WeeklyMenuSharePayload = {
    v: 1,
    weekStartDate,
    items,
    generatedAt: new Date().toISOString(),
  }
  return toBase64Url(JSON.stringify(payload))
}

export function parseWeeklyMenuShareCode(code: string): { weekStartDate: string; items: WeeklyMenuItem[] } {
  const json = fromBase64Url(code.trim())
  const payload = JSON.parse(json) as Partial<WeeklyMenuSharePayload>

  if (payload.v !== 1 || typeof payload.weekStartDate !== 'string') {
    throw new Error('共有コードのバージョンが不正です')
  }
  assertItems(payload.items)

  return {
    weekStartDate: payload.weekStartDate,
    items: payload.items,
  }
}

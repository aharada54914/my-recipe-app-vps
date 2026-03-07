const RETRY_SECONDS_PATTERN = /Please retry in\s+([0-9]+(?:\.[0-9]+)?)s/i

function parseRetrySeconds(message: string): number | null {
  const matched = message.match(RETRY_SECONDS_PATTERN)
  if (!matched) return null
  const parsed = Number(matched[1])
  if (!Number.isFinite(parsed)) return null
  return Math.max(1, Math.ceil(parsed))
}

export function toUserFriendlyGeminiError(error: unknown): string {
  const rawMessage = error instanceof Error ? error.message : String(error ?? '')

  if (!rawMessage) {
    return '解析に失敗しました。時間をおいて再試行してください。'
  }

  const normalized = rawMessage.toLowerCase()
  const isQuotaError =
    rawMessage.includes('[429') ||
    normalized.includes('quota exceeded') ||
    normalized.includes('exceeded your current quota')

  if (isQuotaError) {
    const retryAfterSeconds = parseRetrySeconds(rawMessage)
    const waitMessage = retryAfterSeconds
      ? `約${retryAfterSeconds}秒待って再実行してください。`
      : '少し時間をおいて再実行してください。'

    return `Gemini APIの利用上限に達しました（429）。${waitMessage} 続く場合は「設定 → AI」でAPIキー・プラン・モデル（2.0 Flash Lite推奨）を確認してください。`
  }

  if (normalized.includes('api key') && normalized.includes('not')) {
    return 'Gemini APIキーが無効、または設定されていません。設定画面でキーを確認してください。'
  }

  return rawMessage
}

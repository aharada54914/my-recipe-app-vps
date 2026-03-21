import { getCachedGeminiApiKey, hasEncryptedGeminiApiKey, hasLegacyPlaintextGeminiApiKey } from './geminiKeyVault'
import { getTodayUsageStats } from './geminiSettings'
import { resolveGeminiApiKey } from './geminiClient'

export type StatusTone = 'info' | 'success' | 'warning' | 'error'
export type IntegrationActionId =
  | 'backup-now'
  | 'configure-google-client'
  | 'encrypt-gemini-key'
  | 'open-gemini-settings'
  | 'open-gemini-models'
  | 'open-gemini-usage'
  | 'qa-backup'
  | 'qa-calendar'
  | 'retry-calendar'
  | 'retry-google'
  | 'sign-in-google'
  | 'unlock-gemini-key'

export interface IntegrationStatus {
  tone: StatusTone
  title: string
  message: string
  actionLabel?: string
  actionId?: IntegrationActionId
}

interface GoogleIntegrationParams {
  isOAuthAvailable: boolean
  userPresent: boolean
  providerTokenPresent: boolean
  isQaMode?: boolean
  backupError?: string | null
  isBackingUp?: boolean
  isRestoring?: boolean
}

interface GeminiIntegrationParams {
  isBusy?: boolean
  lastError?: string | null
}

interface CalendarIntegrationParams {
  isOAuthAvailable?: boolean
  userPresent: boolean
  providerTokenPresent: boolean
  isQaMode?: boolean
  loading?: boolean
  error?: string | null
  calendarCount?: number
  selectedCalendarIdPresent?: boolean
}

export function getGoogleIntegrationStatus({
  isOAuthAvailable,
  userPresent,
  providerTokenPresent,
  isQaMode = false,
  backupError,
  isBackingUp = false,
  isRestoring = false,
}: GoogleIntegrationParams): IntegrationStatus {
  if (isQaMode) {
    return {
      tone: 'success',
      title: 'QA 用の Google 連携を使用中です',
      message: 'Drive バックアップとカレンダー登録はモック動作です。実アカウントを使わずに導線を検証できます。',
      actionLabel: 'モックバックアップ',
      actionId: 'qa-backup',
    }
  }

  if (!isOAuthAvailable) {
    return {
      tone: 'warning',
      title: 'Google連携は未設定です',
      message: 'Client ID を設定すると、Drive バックアップとカレンダー登録が使えるようになります。',
      actionLabel: 'Client ID を設定',
      actionId: 'configure-google-client',
    }
  }

  if (backupError) {
    return {
      tone: 'error',
      title: 'Google連携でエラーが発生しています',
      message: backupError,
      actionLabel: '再試行する',
      actionId: 'retry-google',
    }
  }

  if (isRestoring) {
    return {
      tone: 'info',
      title: 'Google Drive から復元中です',
      message: '在庫・お気に入り・献立などを順次読み込んでいます。',
    }
  }

  if (isBackingUp) {
    return {
      tone: 'info',
      title: 'Google Drive にバックアップ中です',
      message: '変更内容を保存しています。このまま操作を続けられます。',
    }
  }

  if (userPresent && providerTokenPresent) {
    return {
      tone: 'success',
      title: 'Google連携は利用可能です',
      message: 'Drive バックアップとカレンダー登録をこの端末から利用できます。',
      actionLabel: '今すぐバックアップ',
      actionId: 'backup-now',
    }
  }

  return {
    tone: 'info',
    title: 'Googleログインが必要です',
    message: 'ログインすると、Drive バックアップとカレンダー登録が有効になります。',
    actionLabel: 'Googleでログイン',
    actionId: 'sign-in-google',
  }
}

export function getGeminiIntegrationStatus(
  estimatedDailyLimit: number,
  { isBusy = false, lastError }: GeminiIntegrationParams = {},
): IntegrationStatus {
  const hasResolvedKey = !!resolveGeminiApiKey()
  const hasEncryptedKey = hasEncryptedGeminiApiKey()
  const hasLegacyKey = hasLegacyPlaintextGeminiApiKey()
  const hasSessionKey = !!getCachedGeminiApiKey()
  const usage = getTodayUsageStats()
  const remaining = Math.max(0, estimatedDailyLimit - usage.requestCount)

  if (lastError) {
    return {
      tone: 'error',
      title: 'Gemini でエラーが発生しました',
      message: lastError,
      actionLabel: '設定を確認',
      actionId: 'open-gemini-settings',
    }
  }

  if (isBusy) {
    return {
      tone: 'info',
      title: 'Gemini を処理中です',
      message: '解析や生成が完了するまで、このまましばらく待ってください。',
    }
  }

  if (!hasResolvedKey && !hasEncryptedKey && !hasLegacyKey) {
    return {
      tone: 'warning',
      title: 'Gemini は未設定です',
      message: 'APIキーを登録すると、URL解析、画像解析、在庫提案、チャットが利用できます。',
      actionLabel: 'APIキーを登録',
      actionId: 'open-gemini-settings',
    }
  }

  if (!hasResolvedKey && hasEncryptedKey && !hasSessionKey) {
    return {
      tone: 'info',
      title: 'Gemini の鍵は保存済みです',
      message: '暗号化済みの API キーがあります。復号するとこのセッションで利用できます。',
      actionLabel: '復号する',
      actionId: 'unlock-gemini-key',
    }
  }

  if (hasLegacyKey && !hasEncryptedKey) {
    return {
      tone: 'warning',
      title: 'Gemini キーが旧形式で保存されています',
      message: '安全性のため、暗号化して再保存することを推奨します。',
      actionLabel: '暗号化して保存',
      actionId: 'encrypt-gemini-key',
    }
  }

  if (remaining <= 5) {
    return {
      tone: 'warning',
      title: 'Gemini の推定残量が少なくなっています',
      message: `今日の推定残り回数は ${remaining} 回です。必要に応じて軽量モデルへ切り替えてください。`,
      actionLabel: 'モデル設定を見る',
      actionId: 'open-gemini-models',
    }
  }

  return {
    tone: 'success',
    title: 'Gemini は利用可能です',
    message: `今日の推定利用回数は ${usage.requestCount} 回です。現在の設定でそのまま使えます。`,
    actionLabel: '利用状況を見る',
    actionId: 'open-gemini-usage',
  }
}

export function getCalendarIntegrationStatus({
  isOAuthAvailable = true,
  userPresent,
  providerTokenPresent,
  isQaMode = false,
  loading = false,
  error,
  calendarCount = 0,
  selectedCalendarIdPresent = false,
}: CalendarIntegrationParams): IntegrationStatus {
  if (isQaMode && userPresent && providerTokenPresent) {
    return {
      tone: 'success',
      title: 'QA 用のカレンダー接続を使用中です',
      message: '予定はこの端末内のモックに保存されます。実カレンダーには送信されません。',
      actionLabel: 'モック一覧を確認',
      actionId: 'qa-calendar',
    }
  }

  if (!isOAuthAvailable) {
    return {
      tone: 'warning',
      title: 'Google連携の設定が必要です',
      message: 'Client ID を設定すると、カレンダー一覧の取得と予定登録が使えるようになります。',
      actionLabel: 'Client ID を設定',
      actionId: 'configure-google-client',
    }
  }

  if (!userPresent || !providerTokenPresent) {
    return {
      tone: 'info',
      title: 'カレンダー連携には Google ログインが必要です',
      message: 'ログインすると、献立予定と買い物リストを Google カレンダーへ直接登録できます。',
      actionLabel: 'Googleでログイン',
      actionId: 'sign-in-google',
    }
  }

  if (loading) {
    return {
      tone: 'info',
      title: 'カレンダー一覧を読み込み中です',
      message: '登録先候補を取得しています。このまま少しお待ちください。',
    }
  }

  if (error) {
    return {
      tone: 'error',
      title: 'カレンダー一覧の取得に失敗しました',
      message: error,
      actionLabel: '再読み込み',
      actionId: 'retry-calendar',
    }
  }

  if (calendarCount === 0) {
    return {
      tone: 'warning',
      title: '利用できるカレンダーが見つかりません',
      message: 'Google 側で利用可能なカレンダーが返っていません。共有設定や権限を確認してください。',
      actionLabel: '再読み込み',
      actionId: 'retry-calendar',
    }
  }

  return {
    tone: 'success',
    title: selectedCalendarIdPresent ? '登録先カレンダーを選択済みです' : '登録先カレンダーを選べます',
    message: `${calendarCount} 件のカレンダーを読み込みました。よく使う登録先をここで固定できます。`,
    actionLabel: '登録先を確認',
    actionId: 'qa-calendar',
  }
}

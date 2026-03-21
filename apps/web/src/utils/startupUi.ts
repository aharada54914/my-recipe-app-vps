export type AppStartupStatus = 'loading' | 'ready' | 'degraded'

export function shouldShowBlockingSplash(splashDone: boolean, startupStatus: AppStartupStatus): boolean {
  return !splashDone || startupStatus === 'loading'
}

export function getStartupNotice(startupStatus: AppStartupStatus, timedOut: boolean): string | null {
  if (startupStatus !== 'degraded') return null
  if (timedOut) return '初期化に時間がかかっているため、基本画面を先に表示しています。バックグラウンド処理は継続中です。'
  return '初期化の一部に失敗したため、表示を継続しています。再読み込みで復旧する場合があります。'
}

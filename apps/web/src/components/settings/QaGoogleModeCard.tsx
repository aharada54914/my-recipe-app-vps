import { useState } from 'react'
import { CalendarDays, FlaskConical, HardDriveDownload, HardDriveUpload, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useGoogleDriveSync } from '../../hooks/useGoogleDriveSync'
import { useUIStore } from '../../stores/uiStore'
import {
  clearQaGoogleCalendarEvents,
  clearQaGoogleDriveBackup,
  getQaGoogleSummary,
  setQaGoogleModeEnabled,
  setQaGoogleModeUrl,
} from '../../lib/qaGoogleMode'
import { StatusNotice } from '../StatusNotice'

const LAST_BACKUP_KEY = 'last_backup_at'

export function QaGoogleModeCard() {
  const { isQaGoogleMode } = useAuth()
  const { backupNow, restoreNow, isBackingUp, isRestoring } = useGoogleDriveSync()
  const addToast = useUIStore((state) => state.addToast)
  const [qaSummary, setQaSummary] = useState(() => getQaGoogleSummary())

  const refreshQaSummary = () => {
    setQaSummary(getQaGoogleSummary())
  }

  const handleEnableQaMode = () => {
    setQaGoogleModeUrl(true)
    setQaGoogleModeEnabled(true)
    refreshQaSummary()
    addToast({ type: 'info', message: 'QA Google モードを有効にしました' })
  }

  const handleBackupMockDrive = async () => {
    await backupNow()
    refreshQaSummary()
  }

  const handleRestoreMockDrive = async () => {
    await restoreNow('prefer-drive')
    refreshQaSummary()
  }

  const handleClearQaStorage = () => {
    clearQaGoogleDriveBackup()
    clearQaGoogleCalendarEvents()
    localStorage.removeItem(LAST_BACKUP_KEY)
    refreshQaSummary()
    addToast({ type: 'success', message: 'QA 用の Drive と Calendar 記録を消去しました' })
  }

  const handleDisableQaMode = () => {
    setQaGoogleModeUrl(false)
    setQaGoogleModeEnabled(false)
    addToast({ type: 'info', message: 'QA Google モードを終了しました' })
  }

  return (
    <div className="ui-panel">
      <StatusNotice
        tone={isQaGoogleMode ? 'success' : 'info'}
        title="Google 連携 QA モード"
        message="実アカウントを使わずに、Google ログイン済み状態、Drive バックアップ、カレンダー登録の導線を検証できます。"
        className="mb-4"
        icon={<FlaskConical className="h-4 w-4" />}
      />

      <div className="grid grid-cols-2 gap-2">
        <div className="ui-stat-card">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-tertiary">Drive</p>
          <p className="mt-1 text-sm font-bold text-text-primary">
            {qaSummary.hasMockBackup ? 'モック保存あり' : '未保存'}
          </p>
        </div>
        <div className="ui-stat-card">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-tertiary">Calendar</p>
          <p className="mt-1 text-sm font-bold text-text-primary">
            {qaSummary.calendarEventCount}件のモック予定
          </p>
        </div>
      </div>

      {!isQaGoogleMode ? (
        <div className="mt-4 space-y-3">
          <button
            data-testid="qa-google-enable"
            onClick={handleEnableQaMode}
            className="ui-btn ui-btn-primary flex w-full items-center justify-center gap-2"
          >
            <FlaskConical className="h-4 w-4" />
            QA Google モードを有効にする
          </button>
          <p className="text-xs leading-relaxed text-text-secondary">
            旧 URL の `?qa-google=1` でも有効化できます。
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <button
            data-testid="qa-google-backup"
            onClick={handleBackupMockDrive}
            disabled={isBackingUp || isRestoring}
            className="ui-btn ui-btn-primary flex w-full items-center justify-center gap-2 disabled:opacity-50"
          >
            <HardDriveUpload className={`h-4 w-4 ${isBackingUp ? 'animate-spin' : ''}`} />
            {isBackingUp ? 'モック Drive に保存中...' : '現在の状態をモック Drive に保存'}
          </button>
          <button
            data-testid="qa-google-restore"
            onClick={handleRestoreMockDrive}
            disabled={isBackingUp || isRestoring || !qaSummary.hasMockBackup}
            className="ui-btn ui-btn-secondary flex w-full items-center justify-center gap-2 disabled:opacity-40"
          >
            <HardDriveDownload className={`h-4 w-4 ${isRestoring ? 'animate-spin' : ''}`} />
            {isRestoring ? 'モック Drive から復元中...' : 'モック Drive から復元'}
          </button>
          <button
            data-testid="qa-google-clear"
            onClick={handleClearQaStorage}
            className="ui-btn ui-btn-secondary flex w-full items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            モック Drive / Calendar 記録を消去
          </button>
          <button
            onClick={handleDisableQaMode}
            className="ui-btn ui-btn-secondary flex w-full items-center justify-center gap-2"
          >
            <CalendarDays className="h-4 w-4" />
            QA Google モードを終了
          </button>
        </div>
      )}
    </div>
  )
}

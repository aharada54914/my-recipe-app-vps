import { useRef, useState } from 'react'
import { CalendarDays, Download, FlaskConical, HardDriveDownload, HardDriveUpload, Trash2, Upload } from 'lucide-react'
import { exportData } from '../../utils/dataExport'
import { importData, type ImportMode } from '../../utils/dataImport'
import { StockQrShareModal } from './StockQrShareModal'
import { StockQrReceiveModal } from './StockQrReceiveModal'
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
const QA_GOOGLE_QUERY_PARAM = 'qa-google'

export function DataTab() {
  const { isQaGoogleMode } = useAuth()
  const { backupNow, restoreNow, isBackingUp, isRestoring } = useGoogleDriveSync()
  const addToast = useUIStore((state) => state.addToast)
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle')
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')
  const [importMode, setImportMode] = useState<ImportMode>('overwrite')
  const [showQrShare, setShowQrShare] = useState(false)
  const [showQrReceive, setShowQrReceive] = useState(false)
  const [qaSummary, setQaSummary] = useState(() => getQaGoogleSummary())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qaControlsVisible = isQaGoogleMode
    || import.meta.env.DEV
    || (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has(QA_GOOGLE_QUERY_PARAM))

  const refreshQaSummary = () => {
    setQaSummary(getQaGoogleSummary())
  }

  const handleExport = async () => {
    setExportStatus('exporting')
    try {
      await exportData()
      setExportStatus('done')
    } catch {
      setExportStatus('error')
    }
    setTimeout(() => setExportStatus('idle'), 3000)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportStatus('importing')
    const result = await importData(file, importMode)
    setImportMessage(result.message)
    setImportStatus(result.success ? 'done' : 'error')
    setTimeout(() => setImportStatus('idle'), 3000)
    if (fileInputRef.current) fileInputRef.current.value = ''
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
    <>
      <div className="rounded-2xl bg-bg-card p-4">
        <h4 className="mb-3 text-sm font-bold text-text-secondary">データ管理</h4>

        <button
          onClick={handleExport}
          disabled={exportStatus === 'exporting'}
          className="ui-btn ui-btn-secondary mb-3 flex w-full items-center justify-center gap-2 text-sm font-semibold disabled:opacity-30"
        >
          <Download className="h-4 w-4" />
          {exportStatus === 'exporting' ? 'エクスポート中...'
            : exportStatus === 'done' ? 'ダウンロード完了'
              : exportStatus === 'error' ? 'エクスポート失敗'
                : 'データをエクスポート'
          }
        </button>

        <div className="ui-segmented mb-3">
          <button
            onClick={() => setImportMode('overwrite')}
            aria-pressed={importMode === 'overwrite'}
            className="ui-segmented-button"
          >
            上書き
          </button>
          <button
            onClick={() => setImportMode('merge')}
            aria-pressed={importMode === 'merge'}
            className="ui-segmented-button"
          >
            マージ
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importStatus === 'importing'}
          className="ui-btn ui-btn-secondary flex w-full items-center justify-center gap-2 text-sm font-semibold disabled:opacity-30"
        >
          <Upload className="h-4 w-4" />
          {importStatus === 'importing' ? 'インポート中...'
            : importStatus === 'done' ? importMessage
              : importStatus === 'error' ? importMessage
                : 'データをインポート'
          }
        </button>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowQrShare(true)}
            className="ui-btn ui-btn-secondary text-xs font-semibold"
          >
            在庫をQRで共有
          </button>
          <button
            onClick={() => setShowQrReceive(true)}
            className="ui-btn ui-btn-secondary text-xs font-semibold"
          >
            在庫をQRで受信
          </button>
        </div>
      </div>

      {qaControlsVisible && (
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
                本番 URL でも `?qa-google=1` を付けて開くと、このモードを有効化できます。
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
      )}

      <div className="ui-inline-note">
        <p className="text-xs text-text-secondary leading-relaxed">
          「データをエクスポート」することで、レシピ・在庫・お気に入り・メモ・履歴などの全データをJSONファイルとしてお手元に保存できます。<br />
          インポートの際は、「上書き」を選ぶと現在のデータをすべて置き換え、「マージ」を選ぶと現在のデータに不足分を追加（合成）します。
        </p>
      </div>

      {showQrShare && <StockQrShareModal onClose={() => setShowQrShare(false)} />}
      {showQrReceive && <StockQrReceiveModal onClose={() => setShowQrReceive(false)} />}
    </>
  )
}

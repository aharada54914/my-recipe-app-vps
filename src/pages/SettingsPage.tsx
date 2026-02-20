import { useState, useEffect, useRef } from 'react'
import {
  ArrowLeft, Settings, Eye, EyeOff, Lock, Unlock, Wifi, WifiOff,
  Download, Upload, LogIn, LogOut, User, HardDriveUpload, RefreshCw,
  Calendar, UtensilsCrossed, Bell, Database, Cloud,
} from 'lucide-react'
import { exportData } from '../utils/dataExport'
import { importData, type ImportMode } from '../utils/dataImport'
import { useAuth } from '../hooks/useAuth'
import { useGoogleDriveSync } from '../hooks/useGoogleDriveSync'
import { CalendarSettings } from '../components/CalendarSettings'
import { MealPlanSettings } from '../components/MealPlanSettings'
import { NotificationSettings } from '../components/NotificationSettings'

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'たった今'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  return `${Math.floor(hours / 24)}日前`
}

interface SettingsPageProps {
  onBack: () => void
}

const STORAGE_KEY = 'gemini_api_key'

type TabId = 'account' | 'calendar' | 'menu' | 'notify' | 'data'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'アカウント', icon: <User className="h-4 w-4" /> },
  { id: 'calendar', label: 'カレンダー', icon: <Calendar className="h-4 w-4" /> },
  { id: 'menu', label: '献立', icon: <UtensilsCrossed className="h-4 w-4" /> },
  { id: 'notify', label: '通知', icon: <Bell className="h-4 w-4" /> },
  { id: 'data', label: 'データ', icon: <Database className="h-4 w-4" /> },
]

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<TabId>('account')
  const [apiKey, setApiKey] = useState('')
  const [isLocked, setIsLocked] = useState(true)
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [confirmSave, setConfirmSave] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle')
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'done' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')
  const [importMode, setImportMode] = useState<ImportMode>('overwrite')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { user, loading: authLoading, isOAuthAvailable, signInWithGoogle, signOut } = useAuth()
  const { isBackingUp, isRestoring, lastBackupAt, backupNow, error: backupError } = useGoogleDriveSync()

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || ''
    setApiKey(stored)
  }, [])

  const maskedKey = apiKey
    ? `${apiKey.slice(0, 6)}${'•'.repeat(Math.max(0, apiKey.length - 10))}${apiKey.slice(-4)}`
    : ''

  const handleUnlock = () => {
    setIsLocked(false)
    setShowKey(true)
  }

  const handleSave = () => {
    if (!confirmSave) {
      setConfirmSave(true)
      return
    }
    localStorage.setItem(STORAGE_KEY, apiKey.trim())
    setIsLocked(true)
    setShowKey(false)
    setConfirmSave(false)
  }

  const handleCancel = () => {
    const stored = localStorage.getItem(STORAGE_KEY) || ''
    setApiKey(stored)
    setIsLocked(true)
    setShowKey(false)
    setConfirmSave(false)
  }

  const handleTest = async () => {
    setTestStatus('testing')
    try {
      const key = apiKey.trim()
      if (!key) throw new Error('APIキーが空です')

      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      const result = await model.generateContent('hello')
      if (result.response.text()) {
        setTestStatus('success')
      } else {
        throw new Error('レスポンスが空です')
      }
    } catch {
      setTestStatus('error')
    }
    setTimeout(() => setTestStatus('idle'), 3000)
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

  return (
    <div className="min-h-dvh bg-bg-primary">
      <header className="sticky top-0 z-50 bg-bg-primary/95 backdrop-blur-md pt-[calc(env(safe-area-inset-top,0px)+1.5rem)]">
        <div className="flex items-center gap-3 px-4 pb-4">
          <button
            onClick={onBack}
            className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-accent" />
            <h1 className="text-lg font-bold">設定</h1>
          </div>
        </div>

        {/* Vertical section buttons */}
        <div className="border-t border-b border-white/10 px-4 py-3">
          <div className="flex flex-col gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent/15 text-accent ring-1 ring-accent/40'
                    : 'bg-bg-card text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="space-y-4 px-4 py-4 pb-8">

        {/* ── アカウント ── */}
        {activeTab === 'account' && (
          <div className="rounded-2xl bg-bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-accent" />
              <h4 className="text-sm font-bold text-text-secondary">アカウント & バックアップ</h4>
            </div>

            {authLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            ) : user ? (
              <div className="space-y-3">
                {/* User info */}
                <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3">
                  {user.picture ? (
                    <img src={user.picture} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <Cloud className="h-5 w-5 text-green-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{user.name}</p>
                    <p className="truncate text-xs text-text-secondary">{user.email}</p>
                  </div>
                </div>

                {/* Backup status */}
                <div className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-2.5">
                  <HardDriveUpload className="h-4 w-4 text-text-secondary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-secondary">
                      {isRestoring
                        ? 'Drive から復元中...'
                        : isBackingUp
                          ? 'バックアップ中...'
                          : lastBackupAt
                            ? `最終バックアップ: ${formatTimeAgo(lastBackupAt)}`
                            : '未バックアップ'}
                    </p>
                    {backupError && (
                      <p className="text-xs text-red-400 mt-0.5">{backupError}</p>
                    )}
                  </div>
                </div>

                {/* Backup now */}
                <button
                  onClick={backupNow}
                  disabled={isBackingUp || isRestoring}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-accent disabled:opacity-30"
                >
                  <RefreshCw className={`h-4 w-4 ${isBackingUp ? 'animate-spin' : ''}`} />
                  {isBackingUp ? 'バックアップ中...' : '今すぐバックアップ'}
                </button>

                {/* Sign out */}
                <button
                  onClick={signOut}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-red-400"
                >
                  <LogOut className="h-4 w-4" />
                  ログアウト
                </button>
              </div>
            ) : isOAuthAvailable ? (
              <div className="space-y-3">
                <button
                  onClick={signInWithGoogle}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
                >
                  <LogIn className="h-4 w-4" />
                  Googleでログイン
                </button>
                <p className="text-xs text-text-secondary leading-relaxed">
                  ログインするとデータ（在庫・お気に入り・メモ・履歴・献立）があなたのGoogle Driveに自動バックアップされ、機種変更時も復元できます。
                </p>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl bg-white/5 px-4 py-3">
                <p className="text-sm text-text-primary">Googleログインを有効にするには環境変数の設定が必要です。</p>
                <p className="text-xs text-text-secondary">
                  `VITE_GOOGLE_CLIENT_ID` を設定後、再デプロイするとログインボタンが表示されます。
                </p>
                <a
                  href="https://accounts.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-lg bg-bg-card px-3 py-2 text-xs font-medium text-text-secondary hover:text-accent"
                >
                  Googleログインページを開く
                </a>
              </div>
            )}
          </div>
        )}

        {/* ── カレンダー ── */}
        {activeTab === 'calendar' && <CalendarSettings />}

        {/* ── 献立 ── */}
        {activeTab === 'menu' && (
          <>
            <MealPlanSettings />

            {/* API Key Section */}
            <div className="rounded-2xl bg-bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-bold text-text-secondary">Gemini API キー</h4>
                <button
                  onClick={isLocked ? handleUnlock : () => setIsLocked(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-accent"
                >
                  {isLocked ? (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      ロック中
                    </>
                  ) : (
                    <>
                      <Unlock className="h-3.5 w-3.5 text-accent" />
                      編集中
                    </>
                  )}
                </button>
              </div>

              {isLocked ? (
                <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-3">
                  <span className="flex-1 text-sm text-text-secondary font-mono">
                    {apiKey ? maskedKey : '未設定'}
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => { setApiKey(e.target.value); setConfirmSave(false) }}
                      placeholder="APIキーを入力..."
                      className="w-full rounded-xl bg-white/5 px-4 py-3 pr-10 text-base text-text-primary font-mono placeholder:text-text-secondary outline-none ring-1 ring-accent/30"
                    />
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="flex-1 rounded-xl bg-white/5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/10"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleSave}
                      className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-colors ${confirmSave
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-accent hover:bg-accent-hover'
                        }`}
                    >
                      {confirmSave ? '本当に保存しますか？' : '保存'}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleTest}
                disabled={!apiKey.trim() || testStatus === 'testing'}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-accent disabled:opacity-30"
              >
                {testStatus === 'testing' ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                ) : testStatus === 'success' ? (
                  <Wifi className="h-4 w-4 text-green-400" />
                ) : testStatus === 'error' ? (
                  <WifiOff className="h-4 w-4 text-red-400" />
                ) : (
                  <Wifi className="h-4 w-4" />
                )}
                {testStatus === 'testing' ? '接続テスト中...'
                  : testStatus === 'success' ? '✅ 接続成功'
                    : testStatus === 'error' ? '❌ 接続失敗'
                      : '接続テスト'
                }
              </button>
            </div>

            <div className="rounded-2xl bg-white/5 px-4 py-3">
              <p className="text-xs text-text-secondary leading-relaxed">
                APIキーは端末のローカルストレージに保存されます。
                <code className="mx-1 rounded bg-white/10 px-1 py-0.5 text-[10px]">.env</code>
                ファイルにキーが設定されている場合はそちらが優先されます。
              </p>
            </div>
          </>
        )}

        {/* ── 通知 ── */}
        {activeTab === 'notify' && <NotificationSettings />}

        {/* ── データ ── */}
        {activeTab === 'data' && (
          <>
            <div className="rounded-2xl bg-bg-card p-4">
              <h4 className="mb-3 text-sm font-bold text-text-secondary">データ管理</h4>

              <button
                onClick={handleExport}
                disabled={exportStatus === 'exporting'}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-accent disabled:opacity-30"
              >
                <Download className="h-4 w-4" />
                {exportStatus === 'exporting' ? 'エクスポート中...'
                  : exportStatus === 'done' ? 'ダウンロード完了'
                    : exportStatus === 'error' ? 'エクスポート失敗'
                      : 'データをエクスポート'
                }
              </button>

              <div className="mb-3 flex gap-2">
                <button
                  onClick={() => setImportMode('overwrite')}
                  className={`flex-1 rounded-xl py-2 text-xs font-medium transition-colors ${importMode === 'overwrite'
                    ? 'bg-accent text-white'
                    : 'bg-white/5 text-text-secondary hover:bg-white/10'
                    }`}
                >
                  上書き
                </button>
                <button
                  onClick={() => setImportMode('merge')}
                  className={`flex-1 rounded-xl py-2 text-xs font-medium transition-colors ${importMode === 'merge'
                    ? 'bg-accent text-white'
                    : 'bg-white/5 text-text-secondary hover:bg-white/10'
                    }`}
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/10 hover:text-accent disabled:opacity-30"
              >
                <Upload className="h-4 w-4" />
                {importStatus === 'importing' ? 'インポート中...'
                  : importStatus === 'done' ? importMessage
                    : importStatus === 'error' ? importMessage
                      : 'データをインポート'
                }
              </button>
            </div>

            <div className="rounded-2xl bg-white/5 px-4 py-3">
              <p className="text-xs text-text-secondary leading-relaxed">
                エクスポートでレシピ・在庫・お気に入り・メモ・履歴の全データをJSONファイルとして保存できます。
                インポートの「上書き」は既存データを置換、「マージ」は既存データに追加します。
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

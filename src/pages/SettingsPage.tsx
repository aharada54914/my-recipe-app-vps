import { useEffect, useMemo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  BookOpen,
  BrainCircuit,
  ChevronRight,
  Database,
  Info,
  Link2,
  Palette,
  Settings,
  Sparkles,
  UtensilsCrossed,
  Wrench,
} from 'lucide-react'
import { NotificationSettings } from '../components/NotificationSettings'
import { BottomNav } from '../components/BottomNav'
import { AppearanceTab } from '../components/settings/AppearanceTab'
import { MenuTab } from '../components/settings/MenuTab'
import { DataTab } from '../components/settings/DataTab'
import { GuideTab } from '../components/settings/GuideTab'
import { VersionTab } from '../components/settings/VersionTab'
import { AccountSettingsTab } from '../components/settings/AccountSettingsTab'
import { PlanningTab } from '../components/settings/PlanningTab'
import { AdvancedTab } from '../components/settings/AdvancedTab'
import { useAuth } from '../hooks/useAuth'

interface SettingsPageProps {
  onBack: () => void
}

type TabId =
  | 'account'
  | 'planning'
  | 'ai'
  | 'notifications'
  | 'appearance'
  | 'data'
  | 'help'
  | 'about'
  | 'advanced'

type LegacyTabId = 'calendar' | 'menu' | 'notify' | 'guide' | 'version'

type TabMeta = {
  id: TabId
  label: string
  summary: string
  icon: ReactNode
}

const LEGACY_TAB_REDIRECTS: Record<LegacyTabId, TabId> = {
  calendar: 'account',
  menu: 'ai',
  notify: 'notifications',
  guide: 'help',
  version: 'about',
}

const PRIMARY_TABS: TabMeta[] = [
  {
    id: 'account',
    label: '接続',
    summary: 'Google ログイン、Drive バックアップ、カレンダー接続',
    icon: <Link2 className="h-4 w-4" />,
  },
  {
    id: 'planning',
    label: '献立',
    summary: '献立生成、時間帯、自動作成の基準',
    icon: <UtensilsCrossed className="h-4 w-4" />,
  },
  {
    id: 'ai',
    label: 'AI',
    summary: 'Gemini API キー、モデル、利用量',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: 'notifications',
    label: '通知',
    summary: 'ブラウザ通知、調理開始、献立完了のお知らせ',
    icon: <Bell className="h-4 w-4" />,
  },
  {
    id: 'appearance',
    label: '表示',
    summary: 'テーマ、配色、表示モード',
    icon: <Palette className="h-4 w-4" />,
  },
  {
    id: 'data',
    label: 'データ',
    summary: 'エクスポート、インポート、在庫 QR 共有',
    icon: <Database className="h-4 w-4" />,
  },
]

const SUPPORT_TABS: TabMeta[] = [
  {
    id: 'help',
    label: 'ヘルプ',
    summary: '基本の使い方、よくある操作の案内',
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    id: 'about',
    label: 'アプリ情報',
    summary: 'バージョン、開発情報、更新履歴',
    icon: <Info className="h-4 w-4" />,
  },
]

const ADVANCED_TAB: TabMeta = {
  id: 'advanced',
  label: '詳細設定',
  summary: 'OAuth 設定、QA Google モード、検証用項目',
  icon: <Wrench className="h-4 w-4" />,
}

const TAB_META_BY_ID = new Map<TabId, TabMeta>(
  [...PRIMARY_TABS, ...SUPPORT_TABS, ADVANCED_TAB].map((tab) => [tab.id, tab])
)

function renderTab(activeTab: TabId | null) {
  switch (activeTab) {
    case 'account':
      return <AccountSettingsTab />
    case 'planning':
      return <PlanningTab />
    case 'ai':
      return <MenuTab />
    case 'notifications':
      return <NotificationSettings />
    case 'appearance':
      return <AppearanceTab />
    case 'data':
      return <DataTab />
    case 'help':
      return <GuideTab />
    case 'about':
      return <VersionTab />
    case 'advanced':
      return <AdvancedTab />
    default:
      return null
  }
}

function SettingsListSection({
  title,
  tabs,
  onSelect,
}: {
  title: string
  tabs: TabMeta[]
  onSelect: (tabId: TabId) => void
}) {
  return (
    <section className="rounded-2xl bg-bg-card p-4">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.08em] text-text-tertiary">{title}</h2>
      <div className="space-y-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className="flex min-h-[60px] w-full items-center justify-between rounded-2xl border border-border-soft bg-bg-card px-3 py-3 text-left transition-colors hover:bg-bg-card-hover"
          >
            <span className="min-w-0 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-bg-card-hover text-accent">
                {tab.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-text-primary">{tab.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">{tab.summary}</span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" />
          </button>
        ))}
      </div>
    </section>
  )
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isOAuthAvailable, isQaGoogleMode } = useAuth()

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const rawPathTab = location.pathname.split('/')[2] ?? null
  const normalizedTab = rawPathTab && rawPathTab in LEGACY_TAB_REDIRECTS
    ? LEGACY_TAB_REDIRECTS[rawPathTab as LegacyTabId]
    : rawPathTab
  const activeTab = normalizedTab && TAB_META_BY_ID.has(normalizedTab as TabId)
    ? normalizedTab as TabId
    : null

  const showAdvancedTab = import.meta.env.DEV
    || isQaGoogleMode
    || !isOAuthAvailable
    || searchParams.get('advanced') === '1'
    || searchParams.get('qa-google') === '1'
    || activeTab === 'advanced'

  useEffect(() => {
    if (!rawPathTab) return

    if (rawPathTab === 'data' && searchParams.get('qa-google') === '1') {
      navigate(
        { pathname: '/settings/advanced', search: location.search },
        { replace: true }
      )
      return
    }

    if (rawPathTab in LEGACY_TAB_REDIRECTS) {
      navigate(
        { pathname: `/settings/${LEGACY_TAB_REDIRECTS[rawPathTab as LegacyTabId]}`, search: location.search },
        { replace: true }
      )
      return
    }

    if (!TAB_META_BY_ID.has(rawPathTab as TabId)) {
      navigate('/settings', { replace: true })
      return
    }

    if (rawPathTab === 'advanced' && !showAdvancedTab) {
      navigate('/settings', { replace: true })
    }
  }, [location.search, navigate, rawPathTab, searchParams, showAdvancedTab])

  const activeTabMeta = activeTab ? TAB_META_BY_ID.get(activeTab) ?? null : null
  const isTabDetail = activeTab !== null

  const handleHeaderBack = () => {
    if (isTabDetail) {
      navigate('/settings')
      return
    }

    onBack()
  }

  const handleSelectTab = (tabId: TabId) => {
    navigate(`/settings/${tabId}${location.search}`)
  }

  return (
    <div className="min-h-dvh bg-bg-primary">
      <header className="sticky top-0 z-50 border-b border-border-soft bg-bg-primary/98 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
        <div className="flex items-center gap-3 px-4 pb-4">
          <button
            onClick={handleHeaderBack}
            className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-accent" />
            <h1 className="text-xl font-extrabold">{isTabDetail && activeTabMeta ? activeTabMeta.label : '設定'}</h1>
          </div>
        </div>
      </header>

      <main className="space-y-4 px-4 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+6.75rem)]">
        {!isTabDetail ? (
          <>
            <section className="ui-action-card">
              <p className="ui-section-kicker">Settings</p>
              <div className="mt-1 flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-accent-ai" />
                <h2 className="text-xl font-extrabold">よく使う設定をまとめました</h2>
              </div>
              <p className="ui-section-desc mt-1">
                接続、献立、AI を上段に寄せています。日常操作は上の 3 項目だけで完結しやすい構成です。
              </p>
            </section>

            <SettingsListSection title="主要設定" tabs={PRIMARY_TABS} onSelect={handleSelectTab} />
            <SettingsListSection title="サポート" tabs={SUPPORT_TABS} onSelect={handleSelectTab} />

            {showAdvancedTab ? (
              <SettingsListSection title="検証・詳細" tabs={[ADVANCED_TAB]} onSelect={handleSelectTab} />
            ) : null}
          </>
        ) : (
          renderTab(activeTab)
        )}
      </main>

      <BottomNav />
    </div>
  )
}

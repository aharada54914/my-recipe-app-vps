import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Settings, User, Calendar, UtensilsCrossed, Bell, Database, BookOpen, Info, ChevronRight } from 'lucide-react'
import { CalendarSettings } from '../components/CalendarSettings'
import { NotificationSettings } from '../components/NotificationSettings'
import { BottomNav } from '../components/BottomNav'
import { AccountTab } from '../components/settings/AccountTab'
import { MenuTab } from '../components/settings/MenuTab'
import { DataTab } from '../components/settings/DataTab'
import { GuideTab } from '../components/settings/GuideTab'
import { VersionTab } from '../components/settings/VersionTab'

interface SettingsPageProps {
  onBack: () => void
}

type TabId = 'account' | 'calendar' | 'menu' | 'notify' | 'data' | 'guide' | 'version'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'アカウント', icon: <User className="h-4 w-4" /> },
  { id: 'calendar', label: 'カレンダー', icon: <Calendar className="h-4 w-4" /> },
  { id: 'menu', label: '献立', icon: <UtensilsCrossed className="h-4 w-4" /> },
  { id: 'notify', label: '通知', icon: <Bell className="h-4 w-4" /> },
  { id: 'data', label: 'データ', icon: <Database className="h-4 w-4" /> },
  { id: 'guide', label: '使い方', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'version', label: 'バージョン', icon: <Info className="h-4 w-4" /> },
]

export function SettingsPage({ onBack }: SettingsPageProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const pathTab = location.pathname.split('/')[2]
  const activeTab: TabId | null = TABS.some((t) => t.id === pathTab)
    ? (pathTab as TabId)
    : null
  const isTabDetail = activeTab !== null
  const activeTabMeta = activeTab ? TABS.find((t) => t.id === activeTab) : null

  useEffect(() => {
    if (pathTab && !TABS.some((t) => t.id === pathTab)) {
      navigate('/settings', { replace: true })
    }
  }, [navigate, pathTab])

  const handleHeaderBack = () => {
    if (isTabDetail) {
      navigate('/settings')
      return
    }
    onBack()
  }

  return (
    <div className="min-h-dvh bg-bg-primary">
      <header className="sticky top-0 z-50 bg-bg-primary/95 backdrop-blur-md pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
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

      <main className="space-y-4 px-4 py-4 pb-28">
        {/* タブ一覧メニュー */}
        {!isTabDetail && (
          <div className="rounded-2xl bg-bg-card p-4">
            <h2 className="mb-3 text-base font-bold text-text-secondary">設定を行いたい項目をお選びください</h2>
            <div className="space-y-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => navigate(`/settings/${tab.id}`)}
                  className="flex min-h-[48px] w-full items-center justify-between rounded-xl bg-white/5 px-3 py-3 text-left text-base font-semibold text-text-primary transition-colors hover:bg-white/10"
                >
                  <span className="flex items-center gap-3">
                    {tab.icon}
                    <span>{tab.label}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-text-secondary" />
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'account'  && <AccountTab />}
        {activeTab === 'calendar' && <CalendarSettings />}
        {activeTab === 'menu'     && <MenuTab />}
        {activeTab === 'notify'   && <NotificationSettings />}
        {activeTab === 'data'     && <DataTab />}
        {activeTab === 'guide'    && <GuideTab />}
        {activeTab === 'version'  && <VersionTab />}
      </main>

      <BottomNav />
    </div>
  )
}

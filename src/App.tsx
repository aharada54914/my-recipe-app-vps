import { Suspense, lazy, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Outlet, useNavigate, useParams, useLocation } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { initDb } from './db/initDb'
import { AuthProvider } from './contexts/AuthContext'
import { DriveBackupProvider } from './hooks/useGoogleDriveSync'
import { PreferencesProvider } from './contexts/PreferencesContext'
import { Header } from './components/Header'
import { BottomNav } from './components/BottomNav'
import { ToastContainer } from './components/ToastContainer'
import { SplashScreen } from './components/SplashScreen'
import { NotificationScheduler } from './components/NotificationScheduler'
import { GeminiProcessingBanner } from './components/GeminiProcessingBanner'
import { WeeklyMenuImportModal } from './components/WeeklyMenuImportModal'
import { useUIStore } from './stores/uiStore'
import { WEEKLY_MENU_IMPORT_PARAM } from './utils/weeklyMenuQr'
import { getStartupNotice, shouldShowBlockingSplash, type AppStartupStatus } from './utils/startupUi'
import { syncQaGoogleModeFromUrl } from './lib/qaGoogleMode'

const GOOGLE_CLIENT_ID_KEY = 'google_client_id'
const STARTUP_TIMEOUT_MS = 6000

if (typeof window !== 'undefined') {
  syncQaGoogleModeFromUrl()
}
const RecipeList = lazy(() => import('./components/RecipeList').then((module) => ({ default: module.RecipeList })))
const RecipeDetail = lazy(() => import('./components/RecipeDetail').then((module) => ({ default: module.RecipeDetail })))
const StockManager = lazy(() => import('./components/StockManager').then((module) => ({ default: module.StockManager })))
const AiRecipeParser = lazy(() => import('./components/AiRecipeParser').then((module) => ({ default: module.AiRecipeParser })))
const MultiScheduleView = lazy(() => import('./components/MultiScheduleView').then((module) => ({ default: module.MultiScheduleView })))
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((module) => ({ default: module.HistoryPage })))
const FavoritesPage = lazy(() => import('./pages/FavoritesPage').then((module) => ({ default: module.FavoritesPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const WeeklyMenuPage = lazy(() => import('./pages/WeeklyMenuPage').then((module) => ({ default: module.WeeklyMenuPage })))
const AskGeminiPage = lazy(() => import('./pages/AskGeminiPage').then((module) => ({ default: module.AskGeminiPage })))

function RouteFallback() {
  return (
    <div className="px-4 py-6 text-sm text-text-secondary">
      読み込み中...
    </div>
  )
}

function AppLayout({ startupNotice }: { startupNotice: string | null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const addToast = useUIStore((state) => state.addToast)

  // Detect ?import-menu=<base64> URL parameter
  const importMenuParam = new URLSearchParams(location.search).get(WEEKLY_MENU_IMPORT_PARAM)

  return (
    <div className="min-h-dvh bg-bg-primary">
      <Header
        onSettings={() => navigate('/settings')}
        onStock={() => navigate('/stock')}
      />
      <GeminiProcessingBanner />
      <main className="px-4 pb-[calc(env(safe-area-inset-bottom,0px)+6.25rem)]">
        {startupNotice && (
          <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {startupNotice}
          </div>
        )}
        <div key={location.pathname} className="route-enter">
          <Outlet />
        </div>
      </main>
      <BottomNav />
      <ToastContainer />
      {importMenuParam && (
        <WeeklyMenuImportModal
          encoded={importMenuParam}
          onClose={() => {
            history.replaceState(null, '', window.location.pathname)
            navigate(location.pathname, { replace: true })
          }}
          onImported={(weekStartDate) => {
            history.replaceState(null, '', '/weekly-menu')
            navigate('/weekly-menu', { replace: true })
            addToast({ type: 'success', message: `${weekStartDate}週の献立を取り込みました`, durationMs: 4000 })
          }}
        />
      )}
    </div>
  )
}

function SearchPage() {
  const navigate = useNavigate()
  return (
    <Suspense fallback={<RouteFallback />}>
      <RecipeList onSelectRecipe={(id) => navigate(`/recipe/${id}`)} />
    </Suspense>
  )
}

function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  if (!id) return null

  return (
    <div className="route-enter px-4 pb-24 pt-4">
      <Suspense fallback={<RouteFallback />}>
        <RecipeDetail recipeId={Number(id)} onBack={() => navigate(-1)} />
      </Suspense>
    </div>
  )
}

function AiParsePage() {
  const navigate = useNavigate()

  return (
    <div className="route-enter px-4 pb-24 pt-4">
      <Suspense fallback={<RouteFallback />}>
        <AiRecipeParser onBack={() => navigate(-1)} />
      </Suspense>
    </div>
  )
}

function MultiSchedulePage() {
  const navigate = useNavigate()

  return (
    <div className="route-enter px-4 pb-24 pt-4">
      <Suspense fallback={<RouteFallback />}>
        <MultiScheduleView onBack={() => navigate(-1)} />
      </Suspense>
    </div>
  )
}

function SettingsPageWrapper() {
  const navigate = useNavigate()

  return (
    <div className="route-enter">
      <Suspense fallback={<RouteFallback />}>
        <SettingsPage onBack={() => navigate(-1)} />
      </Suspense>
    </div>
  )
}

function App() {
  const [startupStatus, setStartupStatus] = useState<AppStartupStatus>('loading')
  const [startupTimedOut, setStartupTimedOut] = useState(false)
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    const timeout = window.setTimeout(() => {
      if (cancelled) return
      setStartupTimedOut(true)
      setStartupStatus((current) => current === 'loading' ? 'degraded' : current)
    }, STARTUP_TIMEOUT_MS)

    void initDb()
      .then(() => {
        if (cancelled) return
        window.clearTimeout(timeout)
        setStartupTimedOut(false)
        setStartupStatus('ready')
      })
      .catch((error) => {
        console.error('App startup failed', error)
        if (cancelled) return
        window.clearTimeout(timeout)
        setStartupStatus('degraded')
      })

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashDone(true), 2100)
    return () => window.clearTimeout(timer)
  }, [])

  // iOS 100vh fix — compute actual viewport height and set --vh CSS variable
  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`)
    }
    setVh()
    window.addEventListener('resize', setVh)
    window.addEventListener('orientationchange', setVh)
    return () => {
      window.removeEventListener('resize', setVh)
      window.removeEventListener('orientationchange', setVh)
    }
  }, [])

  const showSplash = shouldShowBlockingSplash(splashDone, startupStatus)
  const startupNotice = getStartupNotice(startupStatus, startupTimedOut)

  const inner = (
    <AuthProvider>
      <BrowserRouter>
        <DriveBackupProvider>
          <PreferencesProvider>
            <NotificationScheduler />
            <Routes>
              <Route element={<AppLayout startupNotice={startupNotice} />}>
                <Route
                  index
                  element={(
                    <Suspense fallback={<RouteFallback />}>
                      <HomePage />
                    </Suspense>
                  )}
                />
                <Route path="search" element={<SearchPage />} />
                <Route
                  path="stock"
                  element={(
                    <Suspense fallback={<RouteFallback />}>
                      <StockManager />
                    </Suspense>
                  )}
                />
                <Route
                  path="history"
                  element={(
                    <Suspense fallback={<RouteFallback />}>
                      <HistoryPage />
                    </Suspense>
                  )}
                />
                <Route
                  path="favorites"
                  element={(
                    <Suspense fallback={<RouteFallback />}>
                      <FavoritesPage />
                    </Suspense>
                  )}
                />
                <Route
                  path="weekly-menu"
                  element={(
                    <Suspense fallback={<RouteFallback />}>
                      <WeeklyMenuPage />
                    </Suspense>
                  )}
                />
                <Route
                  path="gemini"
                  element={(
                    <Suspense fallback={<RouteFallback />}>
                      <AskGeminiPage />
                    </Suspense>
                  )}
                />
              </Route>
              <Route path="/recipe/:id" element={<RecipeDetailPage />} />
              <Route path="/ai-parse" element={<AiParsePage />} />
              <Route path="/multi-schedule" element={<MultiSchedulePage />} />
              <Route path="/settings/*" element={<SettingsPageWrapper />} />
            </Routes>
          </PreferencesProvider>
        </DriveBackupProvider>
      </BrowserRouter>
    </AuthProvider>
  )

  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || localStorage.getItem(GOOGLE_CLIENT_ID_KEY) || undefined

  if (showSplash) {
    return <SplashScreen leaving={splashDone} />
  }

  if (!clientId) {
    // No OAuth client ID — skip GoogleOAuthProvider (auth features disabled)
    return inner
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      {inner}
    </GoogleOAuthProvider>
  )
}

export default App

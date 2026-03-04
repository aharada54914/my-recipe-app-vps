import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Outlet, useNavigate, useParams, useLocation } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { initDb } from './db/initDb'
import { AuthProvider } from './contexts/AuthContext'
import { DriveBackupProvider } from './hooks/useGoogleDriveSync'
import { PreferencesProvider } from './contexts/PreferencesContext'
import { Header } from './components/Header'
import { BottomNav } from './components/BottomNav'
import { RecipeList } from './components/RecipeList'
import { RecipeDetail } from './components/RecipeDetail'
import { StockManager } from './components/StockManager'
import { AiRecipeParser } from './components/AiRecipeParser'
import { MultiScheduleView } from './components/MultiScheduleView'
import { HomePage } from './pages/HomePage'
import { HistoryPage } from './pages/HistoryPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { SettingsPage } from './pages/SettingsPage'
import { WeeklyMenuPage } from './pages/WeeklyMenuPage'
import { AskGeminiPage } from './pages/AskGeminiPage'
import { ToastContainer } from './components/ToastContainer'
import { SplashScreen } from './components/SplashScreen'
import { NotificationScheduler } from './components/NotificationScheduler'
import { GeminiProcessingBanner } from './components/GeminiProcessingBanner'
import { WeeklyMenuImportModal } from './components/WeeklyMenuImportModal'
import { WEEKLY_MENU_IMPORT_PARAM } from './utils/weeklyMenuQr'

const GOOGLE_CLIENT_ID_KEY = 'google_client_id'

function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  // Detect ?import-menu=<base64> URL parameter
  const importMenuParam = new URLSearchParams(location.search).get(WEEKLY_MENU_IMPORT_PARAM)

  return (
    <div className="min-h-dvh bg-bg-primary liquid-background">
      <Header
        onSettings={() => navigate('/settings')}
        onStock={() => navigate('/stock')}
      />
      <GeminiProcessingBanner />
      <main className="px-4 pb-24">
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
            alert(`${weekStartDate}週の献立を取り込みました！`)
          }}
        />
      )}
    </div>
  )
}

function SearchPage() {
  const navigate = useNavigate()
  return <RecipeList onSelectRecipe={(id) => navigate(`/recipe/${id}`)} />
}

function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  if (!id) return null

  return (
    <div className="route-enter px-4 pb-24 pt-4">
      <RecipeDetail recipeId={Number(id)} onBack={() => navigate(-1)} />
    </div>
  )
}

function AiParsePage() {
  const navigate = useNavigate()

  return (
    <div className="route-enter px-4 pb-24 pt-4">
      <AiRecipeParser onBack={() => navigate(-1)} />
    </div>
  )
}

function MultiSchedulePage() {
  const navigate = useNavigate()

  return (
    <div className="route-enter px-4 pb-24 pt-4">
      <MultiScheduleView onBack={() => navigate(-1)} />
    </div>
  )
}

function SettingsPageWrapper() {
  const navigate = useNavigate()

  return (
    <div className="route-enter">
      <SettingsPage onBack={() => navigate(-1)} />
    </div>
  )
}

function App() {
  const [dbReady, setDbReady] = useState(false)
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    initDb().then(() => setDbReady(true))
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

  const showSplash = !splashDone || !dbReady

  const inner = (
    <AuthProvider>
      <BrowserRouter>
        <DriveBackupProvider>
          <PreferencesProvider>
            <NotificationScheduler />
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<HomePage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="stock" element={<StockManager />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="favorites" element={<FavoritesPage />} />
                <Route path="weekly-menu" element={<WeeklyMenuPage />} />
                <Route path="gemini" element={<AskGeminiPage />} />
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
    return <SplashScreen leaving={dbReady} />
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

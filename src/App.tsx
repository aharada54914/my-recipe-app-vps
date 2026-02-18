import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Outlet, useNavigate, useParams } from 'react-router-dom'
import { initDb } from './db/initDb'
import { AuthProvider } from './contexts/AuthContext'
import { SyncProvider } from './hooks/useSync'
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

function AppLayout() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-bg-primary">
      <Header
        onAiParse={() => navigate('/ai-parse')}
        onMultiSchedule={() => navigate('/multi-schedule')}
        onSettings={() => navigate('/settings')}
      />
      <main className="px-4 pb-24">
        <Outlet />
      </main>
      <BottomNav />
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

  return <RecipeDetail recipeId={Number(id)} onBack={() => navigate(-1)} />
}

function AiParsePage() {
  const navigate = useNavigate()

  return <AiRecipeParser onBack={() => navigate(-1)} />
}

function MultiSchedulePage() {
  const navigate = useNavigate()

  return <MultiScheduleView onBack={() => navigate(-1)} />
}

function SettingsPageWrapper() {
  const navigate = useNavigate()

  return <SettingsPage onBack={() => navigate(-1)} />
}

function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initDb().then(() => setReady(true))
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

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg-primary">
        <div className="text-text-secondary">読み込み中...</div>
      </div>
    )
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <SyncProvider>
          <PreferencesProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<HomePage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="stock" element={<StockManager />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="favorites" element={<FavoritesPage />} />
                <Route path="weekly-menu" element={<WeeklyMenuPage />} />
              </Route>
              <Route path="/recipe/:id" element={<RecipeDetailPage />} />
              <Route path="/ai-parse" element={<AiParsePage />} />
              <Route path="/multi-schedule" element={<MultiSchedulePage />} />
              <Route path="/settings" element={<SettingsPageWrapper />} />
            </Routes>
          </PreferencesProvider>
        </SyncProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

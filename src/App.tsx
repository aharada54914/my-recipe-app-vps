import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { initDb } from './db/initDb'
import { Header } from './components/Header'
import { BottomNav } from './components/BottomNav'
import { RecipeList } from './components/RecipeList'
import { RecipeDetail } from './components/RecipeDetail'
import { StockManager } from './components/StockManager'
import { AiRecipeParser } from './components/AiRecipeParser'
import { MultiScheduleView } from './components/MultiScheduleView'
import { FavoritesPage } from './pages/FavoritesPage'
import type { TabId } from './db/db'

function AppShell() {
  const [ready, setReady] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('search')
  const navigate = useNavigate()

  useEffect(() => {
    initDb().then(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg-primary">
        <div className="text-text-secondary">読み込み中...</div>
      </div>
    )
  }

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    if (tab === 'search') navigate('/')
    if (tab === 'favorites') navigate('/favorites')
    if (tab === 'stock') navigate('/')
    if (tab === 'history') navigate('/')
  }

  return (
    <div className="min-h-dvh bg-bg-primary">
      <Header
        onAiParse={() => navigate('/ai-parse')}
        onMultiSchedule={() => navigate('/multi-schedule')}
      />
      <main className="px-4 pb-24">
        <Routes>
          <Route
            path="/"
            element={
              <>
                {activeTab === 'search' && (
                  <RecipeList onSelectRecipe={(id) => navigate(`/recipe/${id}`)} />
                )}
                {activeTab === 'stock' && <StockManager />}
                {activeTab === 'history' && (
                  <p className="py-12 text-center text-sm text-text-secondary">
                    履歴機能は準備中です
                  </p>
                )}
              </>
            }
          />
          <Route path="/favorites" element={<FavoritesPage />} />
        </Routes>
      </main>
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  )
}

function RecipeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initDb().then(() => setReady(true))
  }, [])

  if (!ready || !id) return null

  return <RecipeDetail recipeId={Number(id)} onBack={() => navigate(-1)} />
}

function AiParsePage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initDb().then(() => setReady(true))
  }, [])

  if (!ready) return null

  return <AiRecipeParser onBack={() => navigate(-1)} />
}

function MultiSchedulePage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initDb().then(() => setReady(true))
  }, [])

  if (!ready) return null

  return <MultiScheduleView onBack={() => navigate(-1)} />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/recipe/:id" element={<RecipeDetailPage />} />
        <Route path="/ai-parse" element={<AiParsePage />} />
        <Route path="/multi-schedule" element={<MultiSchedulePage />} />
        <Route path="/*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

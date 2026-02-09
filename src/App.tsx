import { useState, useEffect } from 'react'
import type { ViewState, TabId } from './db/db'
import { initDb } from './db/initDb'
import { Header } from './components/Header'
import { BottomNav } from './components/BottomNav'
import { RecipeList } from './components/RecipeList'
import { RecipeDetail } from './components/RecipeDetail'
import { StockManager } from './components/StockManager'
import { AiRecipeParser } from './components/AiRecipeParser'
import { MultiScheduleView } from './components/MultiScheduleView'

function App() {
  const [ready, setReady] = useState(false)
  const [viewState, setViewState] = useState<ViewState>({ view: 'list' })
  const [activeTab, setActiveTab] = useState<TabId>('search')

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

  // Full-screen views (no header/bottom nav)
  if (viewState.view === 'detail') {
    return (
      <RecipeDetail
        recipeId={viewState.recipeId}
        onBack={() => setViewState({ view: 'list' })}
      />
    )
  }

  if (viewState.view === 'ai-parse') {
    return (
      <AiRecipeParser
        onBack={() => setViewState({ view: 'list' })}
      />
    )
  }

  if (viewState.view === 'multi-schedule') {
    return (
      <MultiScheduleView
        onBack={() => setViewState({ view: 'list' })}
      />
    )
  }

  // List view
  return (
    <div className="min-h-dvh bg-bg-primary">
      <Header
        onAiParse={() => setViewState({ view: 'ai-parse' })}
        onMultiSchedule={() => setViewState({ view: 'multi-schedule' })}
      />
      <main className="px-4 pb-24">
        {activeTab === 'search' && (
          <RecipeList
            onSelectRecipe={(id) => setViewState({ view: 'detail', recipeId: id })}
          />
        )}
        {activeTab === 'stock' && <StockManager />}
        {activeTab === 'favorites' && (
          <p className="py-12 text-center text-sm text-text-secondary">
            お気に入り機能は準備中です
          </p>
        )}
        {activeTab === 'history' && (
          <p className="py-12 text-center text-sm text-text-secondary">
            履歴機能は準備中です
          </p>
        )}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}

export default App

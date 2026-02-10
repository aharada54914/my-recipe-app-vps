## CLAUDE.md (English Version)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev       # Start dev server (Vite HMR, http://localhost:5173)
npm run build     # Type-check (tsc -b) then Vite production build
npm run lint      # ESLint (TypeScript + React Hooks rules)
npm run preview   # Preview production build locally
```

## Tech Stack

- **React 19** + TypeScript (strict mode, ES2022 target) + Vite 7
- **Tailwind CSS** for styling
- **Dexie.js** (IndexedDB wrapper) for offline data storage
- **Lucide-react** for icons
- ESLint with typescript-eslint + react-hooks + react-refresh plugins

## Project Vision: Recipe PWA

A recipe management PWA with a dark-themed modern UI, targeting Japanese home cooking appliances (ホットクック/ヘルシオ integration).

### Design System

- Dark background: `bg-[#121214]`, accent orange: `#F97316`
- Cards/buttons: `rounded-xl` / `rounded-2xl` with translucent dark backgrounds
- Sans-serif fonts, bold numerics for emphasis

### Planned Architecture

- **Type definitions** centralized in `src/db/db.ts`
- **Calculation logic** (salt %, quantity conversion) as pure functions in `src/utils/`
- **Key components**: RecipeCard, IngredientList, SearchUI, AI/Stock panels

### Cooking Logic Rules

- **Quantity display**: Use `formatQuantityVibe` — convert to intuitive Japanese expressions ("1個強", "約1/2")
- **Weight rounding**: All gram values round to nearest 10g
- **Salt calculation presets**: 0.6% (薄味), 0.8% (標準), 1.2% (濃いめ) — auto-convert to soy sauce (~16% salt) and miso (~12% salt) in g/ml
- **Reverse schedule**: Calculate start times backward from target "いただきます" time, display as Gantt-style chart

### Integrations

- **Gemini API**: AI recipe analysis
- **PWA**: Offline support, installable app (to be configured)

---

## Performance & Scalability Guidelines

**Target data scale**: ~2000 recipes stored offline

### Critical Performance Rules

#### 🔴 NEVER load all recipes at once
- **Problem**: `db.recipes.toArray()` loads entire dataset into memory (10-20MB for 2000 recipes)
- **Impact**: Crashes on low-memory devices (Android <2GB RAM, older iPhones)
- **Solution**: Use pagination or virtual scrolling

```typescript
// ❌ BAD: Loads all 2000 recipes
const recipes = useLiveQuery(() => db.recipes.toArray())

// ✅ GOOD: Load only what's needed
const PAGE_SIZE = 50
const recipes = useLiveQuery(() => 
  db.recipes
    .offset(page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .toArray(),
  [page]
)
```

#### 🔴 Filter and sort in database, not in JavaScript
- **Problem**: Filtering 2000 items in JS causes UI freezes on every keystroke
- **Solution**: Push filters to Dexie queries

```typescript
// ❌ BAD: Filters in memory
const filtered = recipes.filter(r => r.category === category)

// ✅ GOOD: Filters in IndexedDB
const recipes = useLiveQuery(() => 
  db.recipes.where('category').equals(category).toArray(),
  [category]
)
```

#### 🟡 Add database indexes for common queries
- **Current schema**: Only indexes `id`, `title`, `device`, `category`
- **Missing**: `recipeNumber`, compound indexes like `[category+device]`
- **Impact**: Slow queries on large datasets

```typescript
// Recommended schema upgrade
this.version(2).stores({
  recipes: '++id, title, device, category, recipeNumber, [category+device]'
})
```

#### 🟡 Debounce search input
- **Problem**: Search query runs on every keystroke, causing excessive DB reads
- **Solution**: Use a debounce function to wait for user to stop typing

```typescript
// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Usage in component
const debouncedSearchTerm = useDebounce(searchTerm, 300)
```

#### 🟢 Combine multiple reactive queries
- **Problem**: Multiple `useLiveQuery` hooks can cause redundant DB scans on updates
- **Solution**: Use `Promise.all` to combine related queries into one hook

```typescript
// ❌ BAD: Two separate queries
const hotcookRecipes = useLiveQuery(() => db.recipes.where('device').equals('hotcook').toArray())
const healsioRecipes = useLiveQuery(() => db.recipes.where('device').equals('healsio').toArray())

// ✅ GOOD: One combined query
const [hotcookRecipes, healsioRecipes] = useLiveQuery(() => 
  Promise.all([
    db.recipes.where('device').equals('hotcook').toArray(),
    db.recipes.where('device').equals('healsio').toArray()
  ]),
  [],
  [[], []] // Default value
) ?? [[], []]
```

---

## Advanced Performance Techniques

### 🚀 Strategic use of `React.memo` and `useMemo`
- **Goal**: Prevent unnecessary re-renders of heavy components
- **Target**: `RecipeCard`, `IngredientList`

```typescript
// src/components/RecipeCard.tsx
import React from 'react'

const RecipeCard = React.memo(({ recipe }: { recipe: Recipe }) => {
  // ... component logic
})

// Usage in parent
const memoizedRecipeCard = useMemo(() => <RecipeCard recipe={recipe} />, [recipe])
```

### 🚀 Virtual Scrolling
- **Goal**: Render only visible items in a long list (2000+ recipes)
- **Library**: `@tanstack/react-virtual` or `react-window` (not currently installed)
- **Impact**: Reduces DOM nodes by >95%, making scrolling smooth

```typescript
// Example with @tanstack/react-virtual
import { useVirtualizer } from '@tanstack/react-virtual'

const rowVirtualizer = useVirtualizer({
  count: recipes.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 150, // Estimated height of a recipe card
})

return (
  <div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
      {rowVirtualizer.getVirtualItems().map(virtualItem => (
        <div key={virtualItem.key} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualItem.start}px)` }}>
          <RecipeCard recipe={recipes[virtualItem.index]} />
        </div>
      ))}
    </div>
  </div>
)
```

### 🚀 CSS Containment
- **Goal**: Optimize layout calculations for faster scrolling
- **Properties**: `contain`, `content-visibility`

```css
/* src/components/RecipeCard.css */
.recipe-card {
  contain: layout style paint;
  content-visibility: auto;
}
```

### 🚀 Lazy Loading Images
- **Goal**: Load images only when they are about to enter the viewport
- **API**: `Intersection Observer API`

```typescript
// src/components/LazyImage.tsx
import { useRef, useEffect, useState } from 'react'

const LazyImage = ({ src, alt }: { src: string, alt: string }) => {
  const [isVisible, setIsVisible] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setIsVisible(true)
        observer.disconnect()
      }
    })

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return <img ref={imgRef} src={isVisible ? src : '/placeholder.png'} alt={alt} />
}
```

### 🚀 Offload heavy computations to Web Workers
- **Goal**: Keep the UI thread responsive by moving heavy JS tasks to a background thread
- **Target**: Match rate calculation, complex filtering

```typescript
// src/workers/matchRate.worker.ts
self.onmessage = (e) => {
  const { recipes, stock } = e.data
  // ... heavy calculation
  self.postMessage(recipesWithMatchRate)
}

// Component
const worker = new Worker(new URL('../workers/matchRate.worker.ts', import.meta.url))
worker.postMessage({ recipes, stock })
worker.onmessage = (e) => setRecipes(e.data)
```

### 🚀 React 19 Concurrent Features
- **Goal**: Improve UI responsiveness during state updates
- **APIs**: `useTransition`, `useDeferredValue`

```typescript
// useTransition for non-urgent updates
const [isPending, startTransition] = useTransition()

const handleSearch = (e) => {
  startTransition(() => {
    setSearchTerm(e.target.value)
  })
}

// useDeferredValue for delaying re-renders of heavy components
const deferredRecipes = useDeferredValue(recipes)
```

### 🚀 Optimize Tailwind CSS
- **Goal**: Reduce CSS bundle size by purging unused styles

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  // ...
}
```

---

## Image Handling Strategy (Future-Proof)

### 1. Data Model Design
- **Fields**: `imageUrl?`, `thumbnailUrl?`, `imageBlurHash?` (optional)
- **Benefit**: Existing recipes without images will continue to work

```typescript
// src/db/db.ts
export interface Recipe {
  // ... other fields
  imageUrl?: string
  thumbnailUrl?: string
  imageBlurHash?: string
}
```

### 2. Storage Strategy
- 🔴 **DO NOT store image blobs in IndexedDB**. This will hit storage limits quickly.
- ✅ **Store image URLs only**. Upload images to a CDN (Cloudinary, S3, etc.)

### 3. Null-Safe Component Implementation
- **Goal**: Prevent bugs when `imageUrl` is `undefined`

```typescript
// src/components/RecipeCard.tsx
import { Utensils } from 'lucide-react'

const RecipeImage = ({ recipe }: { recipe: Recipe }) => {
  const [error, setError] = useState(false)

  if (!recipe.imageUrl || error) {
    return <div className="flex items-center justify-center h-32 bg-gray-800"><Utensils className="w-8 h-8 text-gray-500" /></div>
  }

  return <img src={recipe.imageUrl} alt={recipe.title} onError={() => setError(true)} />
}
```

### 4. Progressive Image Loading
- **Library**: `react-blurhash` (requires npm install)
- **Benefit**: Show a blurred placeholder while the full image loads

```typescript
import { Blurhash } from 'react-blurhash'

const ProgressiveImage = ({ recipe }: { recipe: Recipe }) => {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative">
      {!loaded && recipe.imageBlurHash && (
        <Blurhash hash={recipe.imageBlurHash} width="100%" height="100%" />
      )}
      <img 
        src={recipe.imageUrl}
        style={{ display: loaded ? 'block' : 'none' }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
}
```

### 5. Image Optimization Checklist
- [ ] Resize images to a max width (e.g., 800px)
- [ ] Convert to modern formats like WebP
- [ ] Use lazy loading (see above)
- [ ] Generate thumbnails for list views
- [ ] Use a CDN for fast delivery

### 6. Database Migration
- **No data change needed** for existing recipes, as fields are optional

```typescript
// src/db/db.ts
this.version(2).stores({
  recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl'
})
```

### 7. AI Parsing for Images
- When parsing recipes from URLs, extract image URLs from Open Graph or schema.org tags.

---

## UX Enhancement Features

### 1. Fuzzy Search with Synonyms

**Goal**: Handle Japanese ingredient name variations (e.g., "ウインナー" = "ソーセージ" = "フランクフルト")

**Library**: `fuse.js` (not currently installed)

**Implementation Steps**:
1. Install `fuse.js`
2. Create `src/utils/searchUtils.ts`
3. Implement synonym expansion logic
4. Integrate with `RecipeList.tsx`

```typescript
// src/utils/searchUtils.ts
import Fuse from 'fuse.js'

const SYNONYMS: Record<string, string[]> = {
  'ソーセージ': ['ソーセージ', 'ウインナー', 'フランクフルト'],
  'ウインナー': ['ソーセージ', 'ウインナー', 'フランクフルト'],
  'フランクフルト': ['ソーセージ', 'ウインナー', 'フランクフルト'],
  'ベーコン': ['ベーコン', 'パンチェッタ'],
  'パンチェッタ': ['ベーコン', 'パンチェッタ'],
  // ... and so on for other ingredients
  'ひき肉': ['ひき肉', 'ミンチ', '挽肉'],
  'ミンチ': ['ひき肉', 'ミンチ', '挽肉'],
  '挽肉': ['ひき肉', 'ミンチ', '挽肉'],
  '豚肉': ['豚肉', 'ポーク', '豚'],
  'ポーク': ['豚肉', 'ポーク', '豚'],
  '豚': ['豚肉', 'ポーク', '豚'],
  '鶏肉': ['鶏肉', 'チキン', 'とり', '鳥肉'],
  'チキン': ['鶏肉', 'チキン', 'とり', '鳥肉'],
  'とり': ['鶏肉', 'チキン', 'とり', '鳥肉'],
  '牛肉': ['牛肉', 'ビーフ', '牛'],
  'ビーフ': ['牛肉', 'ビーフ', '牛'],
  '牛': ['牛肉', 'ビーフ', '牛'],
  '玉ねぎ': ['玉ねぎ', 'タマネギ', 'オニオン', '玉葱'],
  'タマネギ': ['玉ねぎ', 'タマネギ', 'オニオン', '玉葱'],
  'オニオン': ['玉ねぎ', 'タマネギ', 'オニオン', '玉葱'],
  'じゃがいも': ['じゃがいも', 'ジャガイモ', 'ポテト', '馬鈴薯'],
  'ジャガイモ': ['じゃがいも', 'ジャガイモ', 'ポテト', '馬鈴薯'],
  'ポテト': ['じゃがいも', 'ジャガイモ', 'ポテト', '馬鈴薯'],
  '人参': ['人参', 'ニンジン', 'にんじん', 'キャロット'],
  'ニンジン': ['人参', 'ニンジン', 'にんじん', 'キャロット'],
  'にんじん': ['人参', 'ニンジン', 'にんじん', 'キャロット'],
  'なす': ['なす', 'ナス', '茄子'],
  'ナス': ['なす', 'ナス', '茄子'],
  '茄子': ['なす', 'ナス', '茄子'],
  '卵': ['卵', 'たまご', '玉子', 'エッグ'],
  'たまご': ['卵', 'たまご', '玉子', 'エッグ'],
  '玉子': ['卵', 'たまご', '玉子', 'エッグ'],
  'ご飯': ['ご飯', '米', 'ライス', 'ごはん'],
  '米': ['ご飯', '米', 'ライス', 'ごはん'],
  'ライス': ['ご飯', '米', 'ライス', 'ごはん'],
  'きのこ': ['きのこ', 'しめじ', 'エリンギ', '舞茸', 'マッシュルーム'],
  'しめじ': ['きのこ', 'しめじ', 'エリンギ', '舞茸', 'マッシュルーム'],
  'エリンギ': ['きのこ', 'しめじ', 'エリンギ', '舞茸', 'マッシュルーム'],
  '舞茸': ['きのこ', 'しめじ', 'エリンギ', '舞茸', 'マッシュルーム'],
}

export function expandQuery(query: string): string {
  const terms = query.split(/\s+/)
  const expandedTerms = terms.map(term => {
    const synonyms = SYNONYMS[term]
    return synonyms ? `(${synonyms.join(' | ')})` : term
  })
  return expandedTerms.join(' ')
}

const fuseOptions = {
  keys: ['title', 'ingredients.name'],
  includeScore: true,
  threshold: 0.4, // Adjusted for Japanese
}

export function searchRecipes(recipes: Recipe[], query: string): Recipe[] {
  const expandedQuery = expandQuery(query)
  const fuse = new Fuse(recipes, fuseOptions)
  return fuse.search(expandedQuery).map(result => result.item)
}
```

### 2. Wake Lock (Screen Always-On)

**Goal**: Prevent the screen from sleeping during cooking (on `RecipeDetail` page)

**API**: `navigator.wakeLock`

**Implementation Steps**:
1. Create `src/hooks/useWakeLock.ts`
2. Call the hook in `RecipeDetail.tsx`

```typescript
// src/hooks/useWakeLock.ts
import { useState, useEffect } from 'react'

export function useWakeLock() {
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)

  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator) {
        try {
          const lock = await navigator.wakeLock.request('screen')
          setWakeLock(lock)
        } catch (err) {
          console.error(`${(err as Error).name}, ${(err as Error).message}`)
        }
      }
    }

    requestWakeLock()

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (wakeLock !== null) {
        wakeLock.release()
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [wakeLock])
}
```

### 3. Smart Shopping List

**Goal**: Generate a shopping list of missing ingredients (`recipe ingredients - stock`)

**Implementation Steps**:
1. Create `src/utils/shoppingUtils.ts`
2. Add a button to `RecipeDetail.tsx` to open a modal with the list

```typescript
// src/utils/shoppingUtils.ts
export function getMissingIngredients(recipe: Recipe, stock: StockItem[]): Ingredient[] {
  const stockMap = new Map(stock.map(item => [item.name, item.quantity]))
  return recipe.ingredients.filter(ing => {
    const stockQty = stockMap.get(ing.name) || 0
    return stockQty < ing.quantity
  })
}

export function formatShoppingListForLine(items: Ingredient[]): string {
  if (items.length === 0) return '買い物リストは空です'
  const header = '📝 買い物リスト\n\n'
  const body = items.map(item => `・${item.name} (${item.quantity}${item.unit})`).join('\n')
  return header + body
}

// Component
const missingIngredients = getMissingIngredients(recipe, stock)

return (
  <Modal isOpen={isOpen}>
    <h3 className="mb-4 text-lg font-bold">買い物リスト</h3>
    <ul>
      {missingIngredients.map(ing => (
        <li key={ing.name}>{ing.name}</li>
      ))}
    </ul>
    <button onClick={() => navigator.clipboard.writeText(formatShoppingListForLine(missingIngredients))}>
      {copied ? 'コピー済み' : 'LINE用にコピー'}
    </button>
  </Modal>
)
```

### 4. Personal Notes

**Goal**: Save personal cooking notes per recipe (e.g., "塩を少なめにした")

**Implementation Steps**:
1. Extend DB schema with `userNotes` table
2. Add a text area and save button to `RecipeDetail.tsx`

```typescript
// src/db/db.ts
this.version(2).stores({
  // ... other tables
  userNotes: '++id, recipeId'
})

export interface UserNote {
  id?: number
  recipeId: number
  content: string
  updatedAt: Date
}

// Component
const note = useLiveQuery(() => db.userNotes.where('recipeId').equals(recipe.id).first(), [recipe.id])

const handleSaveNote = async () => {
  await db.userNotes.put({ recipeId: recipe.id, content: noteText, updatedAt: new Date() })
}

return (
  <div>
    <h4 className="text-sm font-bold text-text-secondary">自分メモ</h4>
    <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} />
    <button onClick={handleSaveNote}>{saving ? '保存中...' : 'メモを保存'}</button>
  </div>
)
```

---

## Stock-Based Recipe Search

### 1. Stock Selector UI
- **Goal**: Allow users to select ingredients from their stock

```typescript
// src/components/StockSelector.tsx
const StockSelector = ({ stock, selected, onSelect }) => {
  if (!stock) return <div className="px-4 py-2 text-sm text-text-secondary">読み込み中...</div>

  return (
    <div>
      {stock.map(item => (
        <button key={item.id} onClick={() => onSelect(item.name)}>
          {item.name}
        </button>
      ))}
    </div>
  )
}
```

### 2. Match Rate Calculation
- **Goal**: Calculate the percentage of recipe ingredients available in stock

```typescript
// src/utils/matchRateUtils.ts
export function calculateMatchRate(recipe: Recipe, selectedStock: string[]): number {
  const recipeIngredients = new Set(recipe.ingredients.map(i => i.name))
  const matchedCount = selectedStock.filter(s => recipeIngredients.has(s)).length
  return Math.round((matchedCount / recipe.ingredients.length) * 100)
}
```

### 3. Match Rate Display
- **Goal**: Show the match rate on each `RecipeCard`

```typescript
// src/components/RecipeCard.tsx
const RecipeCard = ({ recipe, matchRate }) => {
  // ...
  return (
    <div>
      {matchRate !== undefined && (
        <span className="... bg-green-500 ...">在庫 {matchRate}%</span>
      )}
      <h3>{recipe.title}</h3>
    </div>
  )
}
```

### 4. Sort by Match Rate
- **Goal**: Sort search results by match rate in descending order

```typescript
// src/pages/SearchPage.tsx
const recipesWithMatchRate = recipes.map(r => ({
  ...r,
  matchRate: calculateMatchRate(r, selectedStock)
}))

const sortedRecipes = recipesWithMatchRate.sort((a, b) => b.matchRate - a.matchRate)
```

---

## UI Design Guidelines

### 1. Header with Search Bar
- **Component**: `src/components/SearchHeader.tsx`
- **Features**: Search input, notification icon

```typescript
// src/components/SearchHeader.tsx
import { Search, Bell } from 'lucide-react'

const SearchHeader = () => (
  <header className="...">
    <Search />
    <input type="text" placeholder="材料・ジャンル・料理名で検索" />
    <Bell />
  </header>
)
```

### 2. Home Page Layout
- **Component**: `src/pages/HomePage.tsx`
- **Layout**: `SearchHeader`, `CategoryGrid`, `IconGrid`

```typescript
// src/pages/HomePage.tsx
const HomePage = () => (
  <div>
    <SearchHeader />
    <h2 className="...">至高のカテゴリー</h2>
    <CategoryGrid />
    <h2 className="...">その他のカテゴリー</h2>
    <IconGrid />
  </div>
)
```

### 3. Bottom Navigation (5 Tabs)
- **Component**: `src/components/BottomNav.tsx`
- **Tabs**: Home, Search, Stock, Favorites, History

```typescript
// src/components/BottomNav.tsx
import { Home, Search, Package, Star, History } from 'lucide-react'

const BottomNav = () => (
  <nav className="...">
    <a href="/"><Home /><span>ホーム</span></a>
    <a href="/search"><Search /><span>検索</span></a>
    <a href="/stock"><Package /><span>在庫</span></a>
    <a href="/favorites"><Star /><span>お気に入り</span></a>
    <a href="/history"><History /><span>履歴</span></a>
  </nav>
)
```

### 4. App Structure
- **Component**: `src/App.tsx`
- **Logic**: Use a router to switch between pages

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'

const App = () => (
  <BrowserRouter>
    <div className="flex flex-col h-screen">
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          {/* ... other routes */}
        </Routes>
      </main>
      <BottomNav />
    </div>
  </BrowserRouter>
)
```

---

## Favorites Feature Implementation

### 1. Database Schema
- **Table**: `favorites`
- **Fields**: `recipeId` (unique)

```typescript
// src/db/db.ts
this.version(3).stores({
  // ... other tables
  favorites: '&recipeId'
})

export interface Favorite {
  recipeId: number
}
```

### 2. Add/Remove Logic
- **Component**: `src/utils/favoritesUtils.ts`

```typescript
// src/utils/favoritesUtils.ts
export const toggleFavorite = async (recipeId: number) => {
  const isFavorite = await db.favorites.get(recipeId)
  if (isFavorite) {
    await db.favorites.delete(recipeId)
  } else {
    await db.favorites.put({ recipeId })
  }
}
```

### 3. UI Integration
- **Components**: `RecipeDetail.tsx`, `RecipeCard.tsx`
- **Icon**: `Star` from `lucide-react`

```typescript
// RecipeDetail.tsx
const isFavorite = useLiveQuery(() => db.favorites.get(recipe.id), [recipe.id])

return (
  <button onClick={() => toggleFavorite(recipe.id)}>
    <Star fill={isFavorite ? 'currentColor' : 'none'} />
  </button>
)
```

### 4. Favorites Page
- **Component**: `src/pages/FavoritesPage.tsx`
- **Logic**: Get all favorite `recipeId`s and then fetch the corresponding recipes

```typescript
// src/pages/FavoritesPage.tsx
const favoriteIds = useLiveQuery(() => db.favorites.toCollection().primaryKeys(), [])
const favoriteRecipes = useLiveQuery(() => db.recipes.where('id').anyOf(favoriteIds).toArray(), [favoriteIds])
```

---

## iOS Chrome Compatibility

**Key Insight**: iOS Chrome uses the WebKit engine, same as Safari. Therefore, **iOS Safari compatibility = iOS Chrome compatibility**.

### 1. Wake Lock API
- ❌ Not supported on iOS
- ✅ **Solution**: Use `NoSleep.js` library or guide users to change settings manually

### 2. IndexedDB
- ⚠️ Not available in private browsing mode
- ⚠️ Strict storage limits (~50MB)
- ✅ **Solution**: Store image URLs, not blobs

### 3. PWA (Add to Home Screen)
- ❌ Not possible from iOS Chrome
- ✅ **Solution**: Possible only from Safari. Guide users to "Open in Safari".

### 4. Touch & Scroll
- ✅ `-webkit-overflow-scrolling: touch` for inertial scrolling
- ✅ Disable tap highlight and long-press menu

### 5. 100vh Problem
- ❌ `100vh` includes the address bar
- ✅ **Solution**: Use JavaScript to calculate the actual viewport height and set a CSS variable (`--vh`)

### 6. Date Picker
- ✅ Use native `<input type="date">` for the best UX on iOS

### 7. Fonts
- ✅ Use `-apple-system` font stack
- ✅ Optimize anti-aliasing

### Testing Environment
- **Primary**: iOS Safari
- **Secondary**: iOS Chrome (for verification)

---

## iPhone 13+ & iOS 26.2 Compatibility

### Target Devices & OS
- **Devices**: iPhone 13, 13 Pro, 13 Pro Max, 14 series, 15 series, 16 series, 17 series
- **OS**: iOS 26.2.1 (latest), 26.2, 26.1, 26.0

### iOS 26 Key Features

- **Liquid Glass**: Dynamic lock screen effect. Optimize PWA icon with `maskable`.
- **Live Translation**: Real-time translation with AirPods.
- **Offline Lyrics**: Reinforces the importance of offline-first PWA design.

### Device-Specific Optimizations

- **Dynamic Island (iPhone 14 Pro+)**: Use `env(safe-area-inset-top)` to avoid content overlap.
- **120Hz ProMotion (Pro models)**: Use `requestAnimationFrame` for smooth animations.
- **Responsive Design**: Support screen sizes from 6.1" to 6.7".

### iOS 26.2 PWA Enhancements

- **Service Worker Stability**: Improved lifecycle management and background sync.
- **IndexedDB Capacity**: Increased from 50MB to ~100MB.
- **Web App Manifest**: Supports `screenshots` for an App Store-like install experience.

### Performance on A15 Bionic & Newer

- **Web Workers**: Use `type: 'module'` for ES module support (iOS 26+).
- **Memory Management**: Monitor usage and clear old caches.
- **Haptic Feedback**: Use `navigator.vibrate(10)` for enhanced touch interactions.

### Testing Environment
- **iPhone 13 (iOS 26.2.1)**: Standard model
- **iPhone 15 Pro (iOS 26.2.1)**: Dynamic Island + 120Hz
- **iPhone 17 Pro (iOS 26.2.1)**: Latest model

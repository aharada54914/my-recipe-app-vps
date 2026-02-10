# CLAUDE.md

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

A recipe management PWA with dark-themed modern UI targeting Japanese home cooking (ホットクック/ヘルシオ integration).

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
  recipes: '++id, title, device, category, recipeNumber, [category+device]',
  stock: '++id, &name',
})
```

#### 🟡 Debounce search input
- **Problem**: Search triggers full dataset scan on every character typed
- **Solution**: Add 300ms debounce to search handler

```typescript
// Option 1: Using lodash (npm install lodash.debounce)
import debounce from 'lodash.debounce'
const debouncedSearch = useMemo(
  () => debounce((value: string) => setSearch(value), 300),
  []
)

// Option 2: Custom implementation (no dependencies)
const debouncedSearch = useMemo(() => {
  let timeoutId: NodeJS.Timeout
  return (value: string) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => setSearch(value), 300)
  }
}, [])
```

#### 🟢 Combine multiple reactive queries
- **Problem**: Multiple `useLiveQuery` calls trigger separate database scans on every update
- **Solution**: Combine related queries into a single `useLiveQuery`

```typescript
// ❌ BAD: Two separate queries
const recipes = useLiveQuery(() => db.recipes.toArray())
const stock = useLiveQuery(() => db.stock.where('inStock').equals(1).toArray())

// ✅ GOOD: Single combined query
const data = useLiveQuery(async () => {
  const [recipes, stock] = await Promise.all([
    db.recipes.limit(PAGE_SIZE).toArray(),
    db.stock.where('inStock').equals(1).toArray()
  ])
  return { recipes, stock }
})
```

### Advanced Performance Techniques

For even smoother user experience on mobile devices:

#### 🚀 Use React.memo and useMemo strategically
- **Purpose**: Prevent unnecessary re-renders of expensive components
- **Apply to**: RecipeCard, ingredient lists, schedule charts

```typescript
// Memoize expensive components
export const RecipeCard = React.memo(({ recipe, matchRate, onClick }) => {
  // Component logic
})

// Memoize expensive calculations
const sortedRecipes = useMemo(
  () => recipes.sort((a, b) => b.matchRate - a.matchRate),
  [recipes]
)
```

#### 🚀 Implement virtual scrolling for long lists
- **Library**: `react-window` or `@tanstack/react-virtual` (not currently installed)
- **Install**: `npm install @tanstack/react-virtual`
- **Benefit**: Only renders visible items (e.g., 10 cards) instead of all 2000
- **Memory savings**: 95%+ reduction in DOM nodes

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: recipes.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 120, // Estimated card height
})
```

#### 🚀 Use CSS containment for better rendering
- **Purpose**: Isolate component rendering to prevent layout thrashing
- **Apply to**: Recipe cards, modals, fixed headers

```css
.recipe-card {
  contain: layout style paint;
  content-visibility: auto;
}
```

#### 🚀 Lazy load images with Intersection Observer
- **Status**: Future feature (no images currently in data model)
- **Purpose**: Load recipe images only when scrolling into view
- **Benefit**: Faster initial page load, reduced bandwidth

```typescript
const [imageSrc, setImageSrc] = useState(placeholderSrc)

useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      setImageSrc(actualSrc)
      observer.disconnect()
    }
  })
  observer.observe(imgRef.current)
  return () => observer.disconnect()
}, [])
```

#### 🚀 Use Web Workers for heavy computations
- **Status**: Not currently implemented (future optimization)
- **Use cases**: Ingredient match rate calculation, schedule optimization
- **Benefit**: Keeps UI thread responsive during heavy processing

```typescript
// worker.ts
self.onmessage = (e) => {
  const { recipes, stockNames } = e.data
  const withRates = recipes.map(r => ({
    recipe: r,
    matchRate: calculateMatchRate(r.ingredients, stockNames)
  }))
  self.postMessage(withRates)
}

// Component
const worker = new Worker(new URL('./worker.ts', import.meta.url))
worker.postMessage({ recipes, stockNames })
worker.onmessage = (e) => setProcessedRecipes(e.data)
```

#### 🚀 Enable React Concurrent Features
- **useTransition**: Mark non-urgent updates (e.g., search filtering)
- **useDeferredValue**: Defer expensive re-renders

```typescript
const [isPending, startTransition] = useTransition()
const deferredSearch = useDeferredValue(search)

const handleSearch = (value: string) => {
  startTransition(() => {
    setSearch(value)
  })
}
```

#### 🚀 Optimize Tailwind CSS output
- **Purpose**: Reduce CSS bundle size for faster load
- **Method**: Ensure proper purging in production build

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  // This ensures unused styles are removed in production
}
```

### Image Handling Strategy (Future-Proof)

**Current state**: No images in recipes
**Future plan**: Add recipe images without breaking existing functionality

#### 📸 Data Model Design

**MUST use optional fields** to ensure backward compatibility:

```typescript
export interface Recipe {
  id?: number
  title: string
  recipeNumber: string
  // ... existing fields ...
  
  // Image fields (optional for backward compatibility)
  imageUrl?: string          // CDN/external URL (preferred)
  thumbnailUrl?: string       // Smaller version for list view
  imageBlurHash?: string      // BlurHash for placeholder (tiny string)
}
```

#### 📸 Storage Strategy

**🔴 NEVER store image blobs in IndexedDB**
- **Problem**: 2000 recipes × 200KB/image = 400MB (exceeds Safari's 50MB limit)
- **Solution**: Store URLs only, host images externally

**Recommended approach**:
1. **Upload to CDN** (Cloudinary, Imgix, S3 + CloudFront)
2. **Store URL in database**: `imageUrl: "https://cdn.example.com/recipes/001.webp"`
3. **Use image optimization service**: Auto-resize, WebP conversion, lazy loading

```typescript
// Example: Cloudinary URL with transformations
const imageUrl = `https://res.cloudinary.com/demo/image/upload/w_800,f_auto,q_auto/recipe-${id}.jpg`
```

#### 📸 Component Implementation (Null-Safe)

**Always handle missing images gracefully**:

```typescript
interface RecipeCardProps {
  recipe: Recipe
}

export const RecipeCard = ({ recipe }: RecipeCardProps) => {
  return (
    <div className="recipe-card">
      {/* Conditional rendering - no error if imageUrl is undefined */}
      {recipe.imageUrl && (
        <img 
          src={recipe.thumbnailUrl || recipe.imageUrl} 
          alt={recipe.title}
          loading="lazy"
          onError={(e) => {
            // Fallback to placeholder on load error
            e.currentTarget.src = '/placeholder-recipe.svg'
          }}
        />
      )}
      
      {/* Fallback icon when no image */}
      {!recipe.imageUrl && (
        <div className="recipe-card-placeholder">
          <Utensils className="h-12 w-12 text-text-secondary" />
        </div>
      )}
      
      <h3>{recipe.title}</h3>
    </div>
  )
}
```

#### 📸 Progressive Image Loading

**Use BlurHash for smooth loading experience**:

**Note**: Requires `npm install react-blurhash` (not currently installed)

```typescript
import { Blurhash } from 'react-blurhash'

const [imageLoaded, setImageLoaded] = useState(false)

return (
  <div className="relative">
    {recipe.imageBlurHash && !imageLoaded && (
      <Blurhash
        hash={recipe.imageBlurHash}
        width="100%"
        height={200}
        resolutionX={32}
        resolutionY={32}
      />
    )}
    {recipe.imageUrl && (
      <img
        src={recipe.imageUrl}
        onLoad={() => setImageLoaded(true)}
        className={imageLoaded ? 'opacity-100' : 'opacity-0'}
      />
    )}
  </div>
)
```

#### 📸 Image Optimization Checklist

When adding images in the future:

- ✅ **Format**: Use WebP (fallback to JPEG for old browsers)
- ✅ **Size**: Max width 800px for detail view, 400px for thumbnails
- ✅ **Compression**: Quality 80-85% (balance between size and quality)
- ✅ **Lazy loading**: Use `loading="lazy"` attribute
- ✅ **Responsive**: Serve different sizes based on screen width
- ✅ **Alt text**: Always include for accessibility
- ✅ **Error handling**: Fallback to placeholder on load failure

#### 📸 Database Migration Example

**When adding image fields later**:

```typescript
class RecipeDB extends Dexie {
  constructor() {
    super('RecipeDB')
    
    // Initial schema (current)
    this.version(1).stores({
      recipes: '++id, title, device, category',
      stock: '++id, &name',
    })
    
    // Future schema with images
    this.version(2).stores({
      recipes: '++id, title, device, category, recipeNumber',
      stock: '++id, &name',
    }).upgrade(tx => {
      // No data migration needed - new fields are optional
      // Existing recipes will have imageUrl: undefined
      return tx.table('recipes').toCollection().modify(recipe => {
        // Optional: Set default placeholder URL
        // recipe.imageUrl = recipe.imageUrl || null
      })
    })
  }
}
```

#### 📸 AI Recipe Parser Enhancement

**Extract image URL from web scraping**:

```typescript
export async function parseRecipeFromUrl(url: string): Promise<Omit<Recipe, 'id'>> {
  const res = await fetch(url)
  const html = await res.text()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  
  // Extract recipe image from Open Graph or schema.org
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
  const schemaImage = doc.querySelector('[itemprop="image"]')?.getAttribute('src')
  const imageUrl = ogImage || schemaImage
  
  // ... existing text extraction ...
  
  return {
    // ... existing fields ...
    imageUrl: imageUrl || undefined, // Optional field
  }
}
```

### Mobile Testing Checklist

Before deploying with 2000+ recipes, test on:

1. **Low-spec Android** (2GB RAM, Android 9-10)
2. **iPhone 8** (iOS 15-16, strict memory limits)
3. **Background recovery**: Open app → switch to other apps → return (should not crash)

### Memory Budget Guidelines

- **Per-page data**: Keep <1MB in memory at any time
- **Image storage**: Store URLs only, not blobs (IndexedDB has 50MB limit on Safari)
- **AI parsing**: Clear DOM after extracting text from fetched HTML

---

## Code Style Preferences

- Use `useLiveQuery` for reactive database queries
- Keep components small and focused (single responsibility)
- Extract complex calculations to `src/utils/` as pure functions
- Type everything strictly (no `any` types)


---

## UX Enhancement Features

Four user experience improvements to make the recipe app more practical for daily cooking.

---

### 1. Fuzzy Search with Synonyms

**Goal**: Handle Japanese ingredient name variations (e.g., "ウインナー" = "ソーセージ" = "フランクフルト")

#### Implementation Steps

**Step 1: Install Fuse.js**
```bash
npm install fuse.js
```

**Step 2: Create synonym dictionary** (`src/utils/searchUtils.ts`)

```typescript
import Fuse from 'fuse.js'
import type { Recipe } from '../db/db'

// Synonym map: key → array of equivalent terms
const SYNONYM_MAP: Record<string, string[]> = {
  // Processed meat
  'ソーセージ': ['ソーセージ', 'ウインナー', 'フランクフルト'],
  'ウインナー': ['ソーセージ', 'ウインナー', 'フランクフルト'],
  'フランクフルト': ['ソーセージ', 'ウインナー', 'フランクフルト'],
  'ベーコン': ['ベーコン', 'パンチェッタ'],
  'パンチェッタ': ['ベーコン', 'パンチェッタ'],
  
  // Meat
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
  
  // Vegetables
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
  
  // Other
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

/**
 * Expand search query with synonyms
 */
function expandSynonyms(query: string): string[] {
  const normalized = query.toLowerCase().trim()
  return SYNONYM_MAP[normalized] || [query]
}

/**
 * Fuzzy search recipes with synonym support
 */
export function searchRecipes(recipes: Recipe[], query: string): Recipe[] {
  if (!query.trim()) return recipes
  
  const expandedTerms = expandSynonyms(query)
  
  const fuse = new Fuse(recipes, {
    keys: [
      { name: 'title', weight: 2 },
      { name: 'ingredients.name', weight: 1 },
      { name: 'category', weight: 0.5 },
    ],
    threshold: 0.4, // Adjusted for Japanese text
    ignoreLocation: true,
  })
  
  const allResults = expandedTerms.flatMap(term => fuse.search(term))
  
  const uniqueRecipes = Array.from(
    new Map(allResults.map(result => [result.item.id, result.item])).values()
  )
  
  return uniqueRecipes
}
```

**Step 3: Update RecipeList.tsx**

**Note**: This replaces the existing simple `includes()` search (lines 29-36) with intelligent fuzzy search.

```typescript
import { searchRecipes } from '../utils/searchUtils'
import { useMemo } from 'react'

// Replace existing filter logic with useMemo for performance
const filtered = useMemo(() => {
  let result = recipes || []
  
  // Category filter
  if (category !== 'すべて') {
    result = result.filter(r => r.category === category)
  }
  
  // Fuzzy search with synonyms
  if (search) {
    result = searchRecipes(result, search)
  }
  
  return result
}, [recipes, category, search])
```

---

### 2. Wake Lock (Screen Always On)

**Goal**: Prevent phone screen from sleeping during cooking (RecipeDetail view)

**Browser support**: Chrome/Edge 84+, Safari 16.4+. Not supported in Firefox (gracefully degrades with console warning).

#### Implementation Steps

**Step 1: Create Wake Lock hook** (`src/hooks/useWakeLock.ts`)

```typescript
import { useEffect, useRef } from 'react'

export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!('wakeLock' in navigator)) {
      console.warn('Wake Lock API not supported')
      return
    }

    const requestWakeLock = async () => {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
        console.log('Wake Lock activated')
      } catch (err) {
        console.error('Wake Lock request failed:', err)
      }
    }

    requestWakeLock()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wakeLockRef.current?.released) {
        requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      wakeLockRef.current?.release()
      console.log('Wake Lock released')
    }
  }, [])
}
```

**Step 2: Use in RecipeDetail.tsx**

```typescript
import { useWakeLock } from '../hooks/useWakeLock'

export function RecipeDetail({ recipeId, onBack }: RecipeDetailProps) {
  useWakeLock()
  
  // ... rest of component
}
```

---

### 3. Smart Shopping List (Missing Ingredients)

**Goal**: Calculate "Recipe ingredients - Stock" and provide copyable list

#### Implementation Steps

**Step 1: Create shopping utilities** (`src/utils/shoppingUtils.ts`)

```typescript
import type { Ingredient, StockItem } from '../db/db'

export interface MissingIngredient {
  name: string
  quantity: number
  unit: string
  inStock: boolean
}

export function calculateMissingIngredients(
  ingredients: Ingredient[],
  stock: StockItem[]
): MissingIngredient[] {
  const stockNames = new Set(stock.filter(s => s.inStock).map(s => s.name))
  
  return ingredients
    .filter(ing => ing.category === 'main')
    .map(ing => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      inStock: stockNames.has(ing.name),
    }))
    .filter(ing => !ing.inStock)
}

export function formatShoppingList(items: MissingIngredient[]): string {
  if (items.length === 0) return '買い物リストは空です'
  
  const header = '📝 買い物リスト\n\n'
  const list = items
    .map(item => `□ ${item.name} ${item.quantity}${item.unit}`)
    .join('\n')
  
  return header + list
}
```

**Step 2: Add UI to RecipeDetail.tsx**

**Integration points**:
- Import statements at the top
- State declarations after existing hooks
- Shopping List button after Schedule section
- Modal at the end of the component (before closing `</div>`)

```typescript
import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ShoppingCart, Copy, Check } from 'lucide-react'
import { db } from '../db/db'
import { calculateMissingIngredients, formatShoppingList } from '../utils/shoppingUtils'

export function RecipeDetail({ recipeId, onBack }: RecipeDetailProps) {
  const [showShoppingList, setShowShoppingList] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const stock = useLiveQuery(() => db.stock.toArray())
  
  const missingIngredients = useMemo(() => {
    if (!recipe || !stock) return []
    return calculateMissingIngredients(adjusted, stock)
  }, [adjusted, stock])
  
  const handleCopyList = async () => {
    const text = formatShoppingList(missingIngredients)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  
  return (
    <div className="min-h-dvh bg-bg-primary">
      {/* ... existing content ... */}
      
      {/* Shopping List Button */}
      {missingIngredients.length > 0 && (
        <button
          onClick={() => setShowShoppingList(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-bold text-white"
        >
          <ShoppingCart className="h-5 w-5" />
          買い物リスト ({missingIngredients.length}件)
        </button>
      )}
      
      {/* Shopping List Modal */}
      {showShoppingList && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-t-2xl bg-bg-card p-6">
            <h3 className="mb-4 text-lg font-bold">買い物リスト</h3>
            <ul className="mb-4 space-y-2">
              {missingIngredients.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-accent">□</span>
                  <span>{item.name}</span>
                  <span className="ml-auto text-text-secondary">
                    {item.quantity}{item.unit}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setShowShoppingList(false)}
                className="flex-1 rounded-xl bg-bg-card-hover py-2 text-sm"
              >
                閉じる
              </button>
              <button
                onClick={handleCopyList}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2 text-sm font-bold text-white"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'コピー済み' : 'LINE用にコピー'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### 4. Personal Notes (Recipe Adjustments)

**Goal**: Save personal cooking notes per recipe (e.g., "塩を少なめにした")

#### Implementation Steps

**Step 1: Extend database schema** (`src/db/db.ts`)

```typescript
export interface UserNote {
  id?: number
  recipeId: number
  content: string
  updatedAt: Date
}

class RecipeDB extends Dexie {
  recipes!: Table<Recipe, number>
  stock!: Table<StockItem, number>
  userNotes!: Table<UserNote, number>

  constructor() {
    super('RecipeDB')
    
    // Existing schema
    this.version(1).stores({
      recipes: '++id, title, device, category',
      stock: '++id, &name',
    })
    
    // Unified version(2): Performance indexes + User notes
    this.version(2).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device]',
      stock: '++id, &name',
      userNotes: '++id, recipeId, updatedAt',
    })
  }
}
```

**Step 2: Add notes UI to RecipeDetail.tsx**

**Integration point**: Add Personal Notes section **before** the Ingredients section in the main content area.

```typescript
import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Save, FileText } from 'lucide-react'
import { db } from '../db/db'

export function RecipeDetail({ recipeId, onBack }: RecipeDetailProps) {
  const [noteContent, setNoteContent] = useState('')
  const [saving, setSaving] = useState(false)
  
  const existingNote = useLiveQuery(
    () => db.userNotes.where('recipeId').equals(recipeId).first(),
    [recipeId]
  )
  
  useEffect(() => {
    if (existingNote) {
      setNoteContent(existingNote.content)
    }
  }, [existingNote])
  
  const handleSaveNote = async () => {
    setSaving(true)
    try {
      if (existingNote) {
        await db.userNotes.update(existingNote.id!, {
          content: noteContent,
          updatedAt: new Date(),
        })
      } else {
        await db.userNotes.add({
          recipeId,
          content: noteContent,
          updatedAt: new Date(),
        })
      }
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <div className="min-h-dvh bg-bg-primary">
      <main className="space-y-6 px-4 pb-8">
        {/* Personal Notes Section */}
        <div className="rounded-2xl bg-bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" />
            <h4 className="text-sm font-bold text-text-secondary">自分メモ</h4>
          </div>
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="調理のコツや調整内容を記録..."
            rows={3}
            className="mb-3 w-full resize-none rounded-xl bg-white/5 px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary outline-none"
          />
          <button
            onClick={handleSaveNote}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? '保存中...' : 'メモを保存'}
          </button>
        </div>
      </main>
    </div>
  )
}
```

---

## Design Constraints

All new features MUST follow these rules:

- **Dark theme**: `bg-[#121214]` for background, `bg-bg-card` for cards
- **Accent color**: `text-[#F97316]` or `bg-accent` for primary actions
- **Mobile-first**: Buttons minimum 44px height for easy tapping
- **Rounded corners**: `rounded-xl` or `rounded-2xl` for modern look
- **Icons**: Use `lucide-react` icons consistently

---

## Testing Checklist

- [ ] Test fuzzy search with various synonym combinations
- [ ] Verify Wake Lock works on iOS Safari and Android Chrome
- [ ] Test shopping list copy on different messaging apps
- [ ] Ensure notes persist after app restart
- [ ] Check all features work offline (PWA mode)


---

## Stock-Based Recipe Search & Match Rate Display

Enhanced search functionality that allows users to select ingredients from their stock and displays recipes sorted by match rate.

### Feature Overview

1. **Stock Selection Search**: Select ingredients from refrigerator inventory to find matching recipes
2. **Match Rate Calculation**: Calculate percentage of recipe ingredients available in stock
3. **Sorted Results**: Display recipes in descending order of match rate
4. **Visual Match Rate**: Show match rate badge on each recipe card

---

### 1. Match Rate Calculation Utility

**Implementation** (`src/utils/matchRateUtils.ts`):

```typescript
import type { Recipe, StockItem } from '../db/db'

/**
 * Calculate match rate: percentage of recipe ingredients available in stock
 * Only counts main ingredients (category === 'main')
 */
export function calculateMatchRate(
  recipe: Recipe,
  stock: StockItem[]
): number {
  const stockNames = new Set(
    stock.filter(s => s.inStock).map(s => s.name.toLowerCase())
  )
  
  const mainIngredients = recipe.ingredients.filter(
    ing => ing.category === 'main'
  )
  
  if (mainIngredients.length === 0) return 0
  
  const matchedCount = mainIngredients.filter(ing =>
    stockNames.has(ing.name.toLowerCase())
  ).length
  
  return Math.round((matchedCount / mainIngredients.length) * 100)
}

/**
 * Sort recipes by match rate (descending)
 */
export function sortByMatchRate(
  recipes: Recipe[],
  stock: StockItem[]
): Array<{ recipe: Recipe; matchRate: number }> {
  return recipes
    .map(recipe => ({
      recipe,
      matchRate: calculateMatchRate(recipe, stock),
    }))
    .sort((a, b) => b.matchRate - a.matchRate)
}
```

---

### 2. Stock Selection Component

**Implementation** (`src/components/StockSelector.tsx`):

```typescript
import { useLiveQuery } from 'dexie-react-hooks'
import { Check } from 'lucide-react'
import { db } from '../db/db'

interface StockSelectorProps {
  selectedStock: string[]
  onToggle: (itemName: string) => void
}

export function StockSelector({ selectedStock, onToggle }: StockSelectorProps) {
  const stock = useLiveQuery(() => db.stock.toArray())
  
  if (!stock) return <div className="px-4 py-2 text-sm text-text-secondary">読み込み中...</div>
  
  const inStockItems = stock.filter(s => s.inStock)
  
  if (inStockItems.length === 0) {
    return (
      <div className="px-4 py-4 text-center text-sm text-text-secondary">
        在庫が登録されていません
      </div>
    )
  }
  
  return (
    <div className="px-4 py-3">
      <h3 className="mb-3 text-sm font-bold text-text-secondary">
        冷蔵庫の在庫から選択
      </h3>
      <div className="flex flex-wrap gap-2">
        {inStockItems.map((item) => {
          const isSelected = selectedStock.includes(item.name)
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.name)}
              className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors ${
                isSelected
                  ? 'bg-accent text-white'
                  : 'bg-bg-card text-text-primary hover:bg-bg-card-hover'
              }`}
            >
              {isSelected && <Check className="h-3 w-3" />}
              {item.name}
            </button>
          )
        })}
      </div>
      {selectedStock.length > 0 && (
        <p className="mt-3 text-xs text-text-secondary">
          {selectedStock.length}個の材料を選択中
        </p>
      )}
    </div>
  )
}
```

---

### 3. Enhanced Search Page with Stock Selection

**Implementation** (`src/pages/SearchPage.tsx`):

```typescript
import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, X } from 'lucide-react'
import { db } from '../db/db'
import { searchRecipes } from '../utils/searchUtils'
import { sortByMatchRate } from '../utils/matchRateUtils'
import { StockSelector } from '../components/StockSelector'
import { RecipeCard } from '../components/RecipeCard'
import { BottomNav } from '../components/BottomNav'

export function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStock, setSelectedStock] = useState<string[]>([])
  const [showStockSelector, setShowStockSelector] = useState(false)
  
  const recipes = useLiveQuery(() => db.recipes.toArray())
  const stock = useLiveQuery(() => db.stock.toArray())
  
  // Filter and sort recipes
  const filteredRecipes = useMemo(() => {
    if (!recipes || !stock) return []
    
    let result = recipes
    
    // Text search (fuzzy + synonyms)
    if (searchQuery.trim()) {
      result = searchRecipes(result, searchQuery)
    }
    
    // Filter by selected stock
    if (selectedStock.length > 0) {
      const selectedSet = new Set(selectedStock.map(s => s.toLowerCase()))
      result = result.filter(recipe =>
        recipe.ingredients.some(ing =>
          selectedSet.has(ing.name.toLowerCase())
        )
      )
    }
    
    // Sort by match rate
    return sortByMatchRate(result, stock)
  }, [recipes, stock, searchQuery, selectedStock])
  
  const handleToggleStock = (itemName: string) => {
    setSelectedStock(prev =>
      prev.includes(itemName)
        ? prev.filter(s => s !== itemName)
        : [...prev, itemName]
    )
  }
  
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedStock([])
  }
  
  return (
    <div className="min-h-dvh bg-bg-primary pb-20 pt-4">
      {/* Search Bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 rounded-xl bg-bg-card px-4 py-3">
          <Search className="h-5 w-5 text-text-secondary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="材料・ジャンル・料理名で検索"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
          />
          {(searchQuery || selectedStock.length > 0) && (
            <button onClick={clearFilters} className="p-1">
              <X className="h-4 w-4 text-text-secondary" />
            </button>
          )}
        </div>
      </div>
      
      {/* Stock Filter Toggle */}
      <div className="px-4 pb-3">
        <button
          onClick={() => setShowStockSelector(!showStockSelector)}
          className={`w-full rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            showStockSelector || selectedStock.length > 0
              ? 'bg-accent text-white'
              : 'bg-bg-card text-text-primary hover:bg-bg-card-hover'
          }`}
        >
          {selectedStock.length > 0
            ? `在庫から検索 (${selectedStock.length}個選択中)`
            : '在庫から検索'}
        </button>
      </div>
      
      {/* Stock Selector */}
      {showStockSelector && (
        <StockSelector
          selectedStock={selectedStock}
          onToggle={handleToggleStock}
        />
      )}
      
      {/* Results Header */}
      <div className="px-4 py-3 border-t border-white/10">
        <p className="text-sm text-text-secondary">
          {filteredRecipes.length}件のレシピ
          {selectedStock.length > 0 && ' (一致率順)'}
        </p>
      </div>
      
      {/* Recipe List */}
      <main className="space-y-3 px-4 pb-4">
        {filteredRecipes.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-secondary">
            レシピが見つかりませんでした
          </div>
        ) : (
          filteredRecipes.map(({ recipe, matchRate }) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              matchRate={selectedStock.length > 0 ? matchRate : undefined}
              onClick={() => {/* Navigate to detail */}}
            />
          ))
        )}
      </main>
      
      <BottomNav activeTab="search" onTabChange={() => {}} />
    </div>
  )
}
```

---

### 4. Match Rate Display on RecipeCard

**Note**: The current `RecipeCard.tsx` already supports `matchRate` prop (lines 39-51). No changes needed!

**Match rate color coding**:
- 🟢 80%+ : Green (most ingredients available)
- 🟡 50-79% : Yellow (some ingredients missing)
- ⚪ 0-49% : Gray (many ingredients missing)

---

## User Flow Example

1. User opens Search page
2. Clicks "在庫から検索" button
3. Stock selector expands showing all available ingredients
4. User selects ingredients (e.g., "玉ねぎ", "豚肉", "人参")
5. Recipe list updates showing only recipes with those ingredients
6. Recipes sorted by match rate (highest first)
7. Each card shows match rate badge (e.g., "在庫 85%")
## UI Design Guidelines (Reference: Recipe App Layout)

Based on the reference images, the app should follow this layout structure for better user experience.

---

### Layout Structure Overview

```
┌─────────────────────────────────┐
│  Header (Search Bar + Menu)     │
├─────────────────────────────────┤
│                                 │
│  Main Content Area              │
│  (Home / Search / Detail)       │
│                                 │
│                                 │
│                                 │
├─────────────────────────────────┤
│  Bottom Navigation (4-5 tabs)   │
└─────────────────────────────────┘
```

---

### 1. Top Search Bar (Alternative Header Design)

**Note**: This is an alternative header design inspired by the reference app. The current `Header.tsx` uses a different structure (logo + action buttons). You can either:
- Replace the existing Header with this design
- Create a new component `SearchHeader.tsx` for this layout
- Keep the existing Header and add a search bar to the main content area

**Design**:
- Fixed at the top of the screen
- Search icon + placeholder text
- Hamburger menu (left) + notification bell (right)

**Implementation** (`src/components/SearchHeader.tsx`):

```typescript
import { Search, Menu, Bell } from 'lucide-react'

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-bg-primary px-4 py-3">
      <div className="flex items-center gap-3">
        {/* Hamburger Menu */}
        <button className="p-2">
          <Menu className="h-6 w-6 text-text-secondary" />
        </button>
        
        {/* Search Bar */}
        <div className="flex-1 flex items-center gap-2 rounded-xl bg-bg-card px-4 py-2">
          <Search className="h-5 w-5 text-text-secondary" />
          <input
            type="text"
            placeholder="材料・ジャンル・料理名で検索"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-secondary outline-none"
          />
        </div>
        
        {/* Notification Bell */}
        <button className="relative p-2">
          <Bell className="h-6 w-6 text-text-secondary" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent" />
        </button>
      </div>
    </header>
  )
}
```

---

### 2. Category Grid (Home Page)

**Design**:
- **Large photo cards**: 3 columns × 2 rows
- Each card shows a photo with category name overlay
- Rounded corners (`rounded-2xl`)
- Photo aspect ratio: ~4:3

**Categories** (reference):
- 至高 (Premium)
- 虚無 (Simple/Minimal)
- 肉料理 (Meat)
- 野菜 (Vegetables)
- ご飯 (Rice dishes)
- 麺類 (Noodles)

**Implementation** (`src/components/CategoryGrid.tsx`):

```typescript
import type { RecipeCategory } from '../db/db'

interface CategoryGridProps {
  onSelectCategory: (category: RecipeCategory) => void
}

// Note: Image paths are placeholders. Replace with actual images or see Image Handling Strategy section.
const CATEGORIES = [
  { id: '主菜', label: '肉料理', image: '/images/meat.jpg' }, // Placeholder
  { id: '副菜', label: '野菜', image: '/images/vegetables.jpg' }, // Placeholder
  { id: 'ご飯もの', label: 'ご飯', image: '/images/rice.jpg' }, // Placeholder
  { id: 'スープ', label: 'スープ', image: '/images/soup.jpg' }, // Placeholder
  { id: 'デザート', label: 'デザート', image: '/images/dessert.jpg' }, // Placeholder
] as const

export function CategoryGrid({ onSelectCategory }: CategoryGridProps) {
  return (
    <div className="px-4 py-6">
      {/* Decorative Header */}
      <div className="mb-6 flex items-center justify-center gap-4">
        <span className="text-2xl">🌿</span>
        <h2 className="text-lg font-bold">至高のカテゴリー</h2>
        <span className="text-2xl">🌿</span>
      </div>
      
      {/* Grid */}
      <div className="grid grid-cols-3 gap-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className="relative aspect-[4/3] overflow-hidden rounded-2xl"
          >
            <img
              src={cat.image}
              alt={cat.label}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <span className="text-xl font-bold text-white drop-shadow-lg">
                {cat.label}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

---

### 3. Icon Grid (Sub-Categories)

**Design**:
- **Small icon cards**: 4 columns × 2 rows
- Each card has an emoji/icon + label
- Pastel background colors
- Rounded corners (`rounded-xl`)

**Sub-categories** (reference):
- もう1品 (One more dish)
- レンジ飯 (Microwave)
- 痩せ飯 (Diet-friendly)
- おつまみ (Snacks)
- 鍋 (Hot pot)
- 節約 (Budget-friendly)
- 揚げ物 (Fried foods)
- スープ (Soup)

**Implementation** (`src/components/IconGrid.tsx`):

```typescript
interface IconGridProps {
  onSelectTag: (tag: string) => void
}

const TAGS = [
  { id: 'quick', label: 'もう1品', icon: '🍽️', bg: 'bg-[#D4C4B0]' },
  { id: 'microwave', label: 'レンジ飯', icon: '📺', bg: 'bg-[#C9C9C9]' },
  { id: 'diet', label: '痩せ飯', icon: '🏋️', bg: 'bg-[#E8E4A0]' },
  { id: 'snack', label: 'おつまみ', icon: '🍷', bg: 'bg-[#C9C9C9]' },
  { id: 'hotpot', label: '鍋', icon: '🍲', bg: 'bg-[#8B7355]' },
  { id: 'budget', label: '節約', icon: '🐷', bg: 'bg-[#E8B4A0]' },
  { id: 'fried', label: '揚げ物', icon: '🍗', bg: 'bg-[#D4A4A0]' },
  { id: 'soup', label: 'スープ', icon: '🥣', bg: 'bg-[#A0C4D4]' },
]

export function IconGrid({ onSelectTag }: IconGridProps) {
  return (
    <div className="grid grid-cols-4 gap-3 px-4 py-6">
      {TAGS.map((tag) => (
        <button
          key={tag.id}
          onClick={() => onSelectTag(tag.id)}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl ${tag.bg} p-4 aspect-square`}
        >
          <span className="text-3xl">{tag.icon}</span>
          <span className="text-xs font-medium text-gray-800">{tag.label}</span>
        </button>
      ))}
    </div>
  )
}
```

---

### 4. Bottom Navigation

**Note**: Updated to 5-tab structure with Favorites tab added.

**Current implementation**: `'search' | 'favorites' | 'stock' | 'history'` (4 tabs)

**Recommended update**: Add Favorites as a visible tab (currently hidden as "準備中")

**Final structure**: 5 tabs
- Tab 1: Home (recipe categories)
- Tab 2: Search (stock-based search)
- Tab 3: Stock (inventory management)
- Tab 4: Favorites (bookmarked recipes)
- Tab 5: History (recently viewed)

**Design**:
- Fixed at the bottom
- 4 tabs with icons + labels
- Active tab highlighted with accent color
- **Exclude "Ranking" tab** (not needed for this app)

**Recommended tabs** (5 tabs):
1. **🏠 ホーム (Home)**: Recipe list / Category browse
2. **🔍 検索 (Search)**: Advanced search with stock selection and match rate sorting
3. **📦 在庫 (Stock)**: Ingredient inventory management
4. **⭐ お気に入り (Favorites)**: Bookmarked recipes for quick access
5. **🕒 履歴 (History)**: Recently viewed recipes

**Note**: Ranking and Calendar tabs are NOT included (not needed for this app)

**Current implementation** (`src/components/BottomNav.tsx` - already exists):
```typescript
import { Home, Search, Package, History } from 'lucide-react'
import type { TabId } from '../db/db'

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-bg-card border-t border-white/10">
      <div className="flex items-center justify-around py-2">
        <button
          onClick={() => onTabChange('search')}
          className={`flex flex-col items-center gap-1 px-4 py-2 ${
            activeTab === 'search' ? 'text-accent' : 'text-text-secondary'
          }`}
        >
          <Home className="h-6 w-6" />
          <span className="text-xs">ホーム</span>
        </button>
        
        <button
          onClick={() => onTabChange('favorites')}
          className={`flex flex-col items-center gap-1 px-4 py-2 ${
            activeTab === 'favorites' ? 'text-accent' : 'text-text-secondary'
          }`}
        >
          <Search className="h-6 w-6" />
          <span className="text-xs">検索</span>
        </button>
        
        <button
          onClick={() => onTabChange('stock')}
          className={`flex flex-col items-center gap-1 px-4 py-2 ${
            activeTab === 'stock' ? 'text-accent' : 'text-text-secondary'
          }`}
        >
          <Package className="h-6 w-6" />
          <span className="text-xs">在庫</span>
        </button>
        
        <button
          onClick={() => onTabChange('history')}
          className={`flex flex-col items-center gap-1 px-4 py-2 ${
            activeTab === 'history' ? 'text-accent' : 'text-text-secondary'
          }`}
        >
          <History className="h-6 w-6" />
          <span className="text-xs">履歴</span>
        </button>
      </div>
    </nav>
  )
}
```

**Recommended update**:
- Change tab IDs to match new structure
- Update `TabId` type in `db.ts`

```typescript
// src/db/db.ts
// Keep existing TabId structure (already has 'favorites')
export type TabId = 'search' | 'favorites' | 'stock' | 'history'

// Update BottomNav.tsx to show all 5 tabs:
// - 'search' → label: "ホーム", icon: Home
// - Add new 'search' functionality → use modal or separate state
// - 'favorites' → label: "お気に入り", icon: Heart (implement favorites feature)
// - 'stock' → label: "在庫", icon: ShoppingCart
// - 'history' → label: "履歴", icon: Clock
```

---

### 5. Home Page Layout (Full Example)

**Integration Note**: This requires changes to `App.tsx`. The current structure shows `<RecipeList />` in the `activeTab === 'search'` section. To add category grids:

**Current structure** (App.tsx):
```typescript
{activeTab === 'search' && <RecipeList onSelectRecipe={...} />}
```

**Proposed structure**:
```typescript
{activeTab === 'search' && (
  <>
    <CategoryGrid onSelectCategory={...} />
    <IconGrid onSelectTag={...} />
    {/* RecipeList shown after category selection */}
  </>
)}
```

**Structure**:
1. Fixed search header (optional - see SearchHeader component)
2. Scrollable content area:
   - Seasonal banner (optional)
   - Category grid (large photos)
   - Icon grid (sub-categories)
3. Fixed bottom navigation

**Reference implementation** (`src/pages/HomePage.tsx` - new file):

```typescript
import { useState } from 'react'
import { Header } from '../components/Header'
import { CategoryGrid } from '../components/CategoryGrid'
import { IconGrid } from '../components/IconGrid'
import { BottomNav } from '../components/BottomNav'

export function HomePage() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  
  return (
    <div className="min-h-dvh bg-bg-primary pb-20 pt-16">
      {/* Fixed Header */}
      <Header />
      
      {/* Scrollable Content */}
      <main>
        {/* Seasonal Banner (optional) */}
        <div className="mx-4 my-4 rounded-2xl bg-gradient-to-r from-blue-100 to-blue-50 p-6 text-center">
          <span className="text-4xl">⛄</span>
          <p className="mt-2 text-sm font-medium text-gray-700">
            長ネギ・白菜・大根
          </p>
        </div>
        
        {/* Category Grid */}
        <CategoryGrid onSelectCategory={(cat) => console.log(cat)} />
        
        {/* Icon Grid */}
        <IconGrid onSelectTag={(tag) => console.log(tag)} />
      </main>
      
      {/* Fixed Bottom Nav */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
```

---

### 6. Search Page Layout

**Design**:
- Search bar at the top
- **Stock selection button**: Toggle ingredient selector from refrigerator inventory
- **Match rate display**: Show percentage of ingredients available in stock
- **Sorted results**: Recipes sorted by match rate (descending) when stock is selected
- Recipe cards with match rate badges

**Implementation** (`src/pages/SearchPage.tsx`):

```typescript
import { useState } from 'react'
import { Header } from '../components/Header'
import { CategoryTags } from '../components/CategoryTags'
import { RecipeList } from '../components/RecipeList'
import { BottomNav } from '../components/BottomNav'

export function SearchPage() {
  const [activeTab, setActiveTab] = useState<TabId>('search')
  
  return (
    <div className="min-h-dvh bg-bg-primary pb-20 pt-16">
      {/* Fixed Header */}
      <Header />
      
      {/* Search Results */}
      <main className="px-4 py-4">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <span className="text-accent">📋</span>
          料理ジャンル
        </h2>
        
        {/* Category Filters */}
        <CategoryTags
          selected={category}
          onSelect={setCategory}
        />
        
        {/* Recipe List */}
        <RecipeList onSelectRecipe={(id) => navigate(`/recipe/${id}`)} />
      </main>
      
      {/* Fixed Bottom Nav */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
```

---

## Design Constraints (Consistent with Existing Guidelines)

- **Dark theme**: `bg-[#121214]` for background
- **Card background**: `bg-bg-card` (translucent dark)
- **Accent color**: `#F97316` (orange) for active states
- **Rounded corners**: `rounded-xl` (12px) or `rounded-2xl` (16px)
- **Fixed elements**: Header and bottom nav should use `fixed` positioning with `z-50`
- **Content padding**: Add `pb-20` (bottom) and `pt-16` (top) to main content to avoid overlap with fixed elements

---

## Key Differences from Reference App

| Feature | Reference App | This App |
|---------|---------------|----------|
| Bottom Nav Tabs | 5 tabs (includes Ranking) | 4 tabs (Home, Search, Stock, History) |
| Category Photos | Real food photos | Placeholder images (to be replaced) |
| Seasonal Banner | Rotating seasonal content | Optional (can be static or removed) |
| Icon Colors | Pastel colors | Darker pastel tones for dark theme |

---

## Implementation Checklist

- [ ] Update `TabId` type to `'home' | 'search' | 'stock' | 'history'`
- [ ] Create `Header.tsx` with search bar
- [ ] Create `CategoryGrid.tsx` with photo cards
- [ ] Create `IconGrid.tsx` with sub-category icons
- [ ] Update `BottomNav.tsx` to match new tab structure
- [ ] Create `HomePage.tsx` combining all components
- [ ] Create `SearchPage.tsx` for search results
- [ ] Add placeholder images for categories
- [ ] Test fixed positioning on mobile devices
## Favorites Feature Implementation

Allow users to bookmark their favorite recipes for quick access.

---

### Feature Overview

1. **Bookmark recipes**: Add/remove recipes from favorites
2. **Favorites tab**: Dedicated tab in bottom navigation
3. **Persistent storage**: Save favorites in IndexedDB
4. **Visual indicator**: Show heart icon on favorited recipes

---

### 1. Database Schema Update

**Add to existing Recipe interface** (`src/db/db.ts`):

```typescript
export interface Recipe {
  id?: number
  // ... existing fields ...
  isFavorite?: boolean // Add this field
}
```

**Or create separate Favorites table** (recommended for scalability):

```typescript
export interface Favorite {
  id?: number
  recipeId: number
  addedAt: Date
}

class RecipeDB extends Dexie {
  recipes!: Table<Recipe, number>
  stock!: Table<StockItem, number>
  userNotes!: Table<UserNote, number>
  favorites!: Table<Favorite, number> // Add this

  constructor() {
    super('RecipeDB')
    
    // ... existing versions ...
    
    // Version 3: Add favorites table
    this.version(3).stores({
      recipes: '++id, title, device, category, recipeNumber, [category+device]',
      stock: '++id, &name',
      userNotes: '++id, recipeId, updatedAt',
      favorites: '++id, &recipeId, addedAt', // Unique constraint on recipeId
    })
  }
}
```

---

### 2. Favorites Utility Functions

**Implementation** (`src/utils/favoritesUtils.ts`):

```typescript
import { db } from '../db/db'

/**
 * Check if recipe is favorited
 */
export async function isFavorite(recipeId: number): Promise<boolean> {
  const favorite = await db.favorites.where('recipeId').equals(recipeId).first()
  return !!favorite
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(recipeId: number): Promise<boolean> {
  const existing = await db.favorites.where('recipeId').equals(recipeId).first()
  
  if (existing) {
    // Remove from favorites
    await db.favorites.delete(existing.id!)
    return false
  } else {
    // Add to favorites
    await db.favorites.add({
      recipeId,
      addedAt: new Date(),
    })
    return true
  }
}

/**
 * Get all favorite recipe IDs
 */
export async function getFavoriteIds(): Promise<number[]> {
  const favorites = await db.favorites.toArray()
  return favorites.map(f => f.recipeId)
}

/**
 * Get all favorite recipes
 */
export async function getFavoriteRecipes() {
  const favoriteIds = await getFavoriteIds()
  if (favoriteIds.length === 0) return []
  
  return db.recipes
    .where('id')
    .anyOf(favoriteIds)
    .toArray()
}
```

---

### 3. Favorite Button Component

**Implementation** (`src/components/FavoriteButton.tsx`):

```typescript
import { useState, useEffect } from 'react'
import { Heart } from 'lucide-react'
import { isFavorite, toggleFavorite } from '../utils/favoritesUtils'

interface FavoriteButtonProps {
  recipeId: number
  size?: 'sm' | 'md' | 'lg'
}

export function FavoriteButton({ recipeId, size = 'md' }: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(false)
  const [loading, setLoading] = useState(false)
  
  useEffect(() => {
    isFavorite(recipeId).then(setFavorited)
  }, [recipeId])
  
  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering parent onClick
    setLoading(true)
    try {
      const newState = await toggleFavorite(recipeId)
      setFavorited(newState)
    } finally {
      setLoading(false)
    }
  }
  
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }
  
  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`rounded-full p-2 transition-colors ${
        favorited
          ? 'bg-accent/20 text-accent'
          : 'bg-bg-card text-text-secondary hover:bg-bg-card-hover'
      }`}
      aria-label={favorited ? 'お気に入りから削除' : 'お気に入りに追加'}
    >
      <Heart
        className={`${sizeClasses[size]} ${favorited ? 'fill-current' : ''}`}
      />
    </button>
  )
}
```

---

### 4. Update RecipeCard to Show Favorite Button

**Add to RecipeCard.tsx**:

```typescript
import { FavoriteButton } from './FavoriteButton'

export function RecipeCard({ recipe, matchRate, onClick }: RecipeCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl bg-bg-card p-4 text-left transition-colors hover:bg-bg-card-hover"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex-1">
          <span className="mb-1 inline-block rounded-lg bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">
            {deviceLabels[recipe.device]}
          </span>
          <h3 className="mt-1 text-base font-bold">{recipe.title}</h3>
        </div>
        
        {/* Favorite Button */}
        <div className="flex items-center gap-2">
          <FavoriteButton recipeId={recipe.id!} size="sm" />
          <span className="rounded-xl bg-accent px-2 py-1 text-xs font-bold text-white">
            No.{recipe.recipeNumber}
          </span>
        </div>
      </div>
      
      {/* ... rest of card ... */}
    </button>
  )
}
```

---

### 5. Favorites Page

**Implementation** (`src/pages/FavoritesPage.tsx`):

```typescript
import { useLiveQuery } from 'dexie-react-hooks'
import { Heart } from 'lucide-react'
import { db } from '../db/db'
import { RecipeCard } from '../components/RecipeCard'
import { BottomNav } from '../components/BottomNav'

export function FavoritesPage() {
  // Get all favorite recipe IDs
  const favoriteIds = useLiveQuery(async () => {
    const favorites = await db.favorites.toArray()
    return favorites.map(f => f.recipeId)
  })
  
  // Get favorite recipes
  const favoriteRecipes = useLiveQuery(async () => {
    if (!favoriteIds || favoriteIds.length === 0) return []
    return db.recipes.where('id').anyOf(favoriteIds).toArray()
  }, [favoriteIds])
  
  return (
    <div className="min-h-dvh bg-bg-primary pb-20 pt-4">
      {/* Header */}
      <header className="px-4 pb-4">
        <div className="flex items-center gap-2">
          <Heart className="h-6 w-6 text-accent" />
          <h1 className="text-xl font-bold">お気に入り</h1>
        </div>
        {favoriteRecipes && (
          <p className="mt-1 text-sm text-text-secondary">
            {favoriteRecipes.length}件のレシピ
          </p>
        )}
      </header>
      
      {/* Recipe List */}
      <main className="space-y-3 px-4">
        {!favoriteRecipes ? (
          <div className="py-8 text-center text-sm text-text-secondary">
            読み込み中...
          </div>
        ) : favoriteRecipes.length === 0 ? (
          <div className="py-12 text-center">
            <Heart className="mx-auto h-12 w-12 text-text-secondary/50" />
            <p className="mt-4 text-sm text-text-secondary">
              お気に入りのレシピがありません
            </p>
            <p className="mt-2 text-xs text-text-secondary">
              レシピカードの♡ボタンでお気に入り登録できます
            </p>
          </div>
        ) : (
          favoriteRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => {/* Navigate to detail */}}
            />
          ))
        )}
      </main>
      
      <BottomNav activeTab="favorites" onTabChange={() => {}} />
    </div>
  )
}
```

---

### 6. Update App.tsx to Show Favorites Tab

**Add to App.tsx**:

```typescript
import { FavoritesPage } from './pages/FavoritesPage'

// In the main render logic:
{activeTab === 'favorites' && <FavoritesPage />}
```

---

### 7. Update BottomNav to Show 5 Tabs

**Update BottomNav.tsx**:

```typescript
import { Home, Search, ShoppingCart, Heart, Clock } from 'lucide-react'

const tabs: { id: TabId; icon: typeof Search; label: string }[] = [
  { id: 'search', icon: Home, label: 'ホーム' },
  { id: 'search-modal', icon: Search, label: '検索' }, // Note: needs separate handling
  { id: 'stock', icon: ShoppingCart, label: '在庫' },
  { id: 'favorites', icon: Heart, label: 'お気に入り' },
  { id: 'history', icon: Clock, label: '履歴' },
]
```

**Alternative approach** (recommended):
Keep 4 tabs in TabId, add search as a modal/overlay triggered by a floating button or header search bar.

---

## Implementation Checklist

- [ ] Update database schema to add `favorites` table (version 3)
- [ ] Create `favoritesUtils.ts` with toggle/check functions
- [ ] Create `FavoriteButton.tsx` component
- [ ] Add FavoriteButton to RecipeCard
- [ ] Create `FavoritesPage.tsx`
- [ ] Update App.tsx to route to FavoritesPage
- [ ] Update BottomNav to show Favorites tab
- [ ] Test favorite toggle functionality
- [ ] Test favorites persistence across app restarts

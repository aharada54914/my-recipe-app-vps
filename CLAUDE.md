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
- StockManager rows use `bg-[#1a1a1c]` (slightly lighter than card bg) for distinction
- Sans-serif fonts, bold numerics for emphasis

### Planned Architecture

- **Type definitions** centralized in `src/db/db.ts`
- **Calculation logic** (salt %, quantity conversion) as pure functions in `src/utils/`
- **Key components**: RecipeCard, RecipeList, StockManager, MultiScheduleView, AiRecipeParser, SearchBar

### Cooking Logic Rules

- **Quantity display**: Use `formatQuantityVibe` — convert to intuitive Japanese expressions ("1個強", "約1/2")
- **Weight rounding**: Calculate values retain decimal precision (1dp). Display rounds to nearest 1g (values <1g also round)
- **Salt calculation presets**: 0.6% (薄味), 0.8% (標準), 1.2% (濃いめ) — auto-convert to soy sauce (~16% salt) and miso (~12% salt) in g/ml
- **Reverse schedule**: Calculate start times backward from target "いただきます" time, display as Gantt-style chart

### Integrations

- **Gemini API**: AI recipe analysis
- **PWA**: Offline support, installable app (vite-plugin-pwa + workbox 設定済み)

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

// ✅ GOOD: Always apply .limit() to prevent unbounded queries
const recipes = useLiveQuery(() =>
  db.recipes.limit(200).toArray()
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
- **Solution**: Create a `useDebounce` hook (300ms delay) to wait for user to stop typing

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
- Wrap components in `React.memo` and use `useMemo` for expensive calculations

### 🚀 Virtual Scrolling
- **Goal**: Render only visible items in a long list (2000+ recipes)
- **Library**: `@tanstack/react-virtual`
- **Impact**: Reduces DOM nodes by >95%, making scrolling smooth
- **Estimated card height**: 88px

### 🚀 CSS Containment
- **Goal**: Optimize layout calculations for faster scrolling
- **Properties**: `contain`, `content-visibility`

```css
/* src/index.css — applied globally to .recipe-card */
.recipe-card {
  contain: layout style paint;
  content-visibility: auto;
  contain-intrinsic-size: auto 88px;
}
```

### 🚀 Lazy Loading Images
- **Goal**: Load images only when they are about to enter the viewport
- **API**: Native `loading="lazy"` attribute on `<img>` (via `RecipeImage.tsx`)
- **Placeholder**: Fallback icon displayed on error

### 🚀 Heavy computation strategy
- **Current approach**: `useTransition` + `useDeferredValue` で十分な応答性を確保
- **将来**: データ規模拡大時に Web Worker への移行を再検討

### 🚀 React 19 Concurrent Features
- **Goal**: Improve UI responsiveness during state updates
- **APIs**: `useTransition` for non-urgent updates, `useDeferredValue` for delaying re-renders
- **Target**: Search input, heavy component re-renders

### 🚀 Optimize Tailwind CSS
- **Goal**: Reduce CSS bundle size by purging unused styles
- Ensure `tailwind.config.js` includes all source files in `content` array

---

## UX Enhancement Features

### 1. Fuzzy Search with Synonyms
- **Goal**: Allow flexible searches (e.g., "豚肉" matches "豚バラ", "豚ロース")
- **Library**: `fuse.js` (requires npm install)
- **Synonym Dictionary**: Create `src/data/synonyms.ts` with common ingredient variations

### 2. Wake Lock (Screen Always-On)
- **Goal**: Keep the screen on while viewing a recipe
- **API**: Screen Wake Lock API (iOS not supported → use `NoSleep.js`)
- **Implementation**: Request wake lock when recipe detail is opened, release on unmount

### 3. Smart Shopping List
- **Goal**: Generate a shopping list of missing ingredients (`recipe ingredients - stock`)
- **Implementation**: Create `src/utils/shoppingUtils.ts` with `getMissingIngredients()` and `formatShoppingListForLine()`
- **UI**: Add button to `RecipeDetail.tsx` to open modal with list and LINE copy button

### 4. Personal Notes
- **Goal**: Save personal cooking notes per recipe (e.g., "塩を少なめにした")
- **DB Schema**: Add `userNotes` table with `id`, `recipeId`, `content`, `updatedAt`
- **UI**: Add textarea and save button to `RecipeDetail.tsx`

### 5. View History
- **Goal**: Track recipe viewing history for quick access
- **DB Schema**: `viewHistory` table with `id`, `recipeId`, `viewedAt`
- **Type**: `ViewHistory { id?: number; recipeId: number; viewedAt: Date }`

---

## Stock-Based Recipe Search

### 1. Stock Manager UI
- **Goal**: Allow users to manage ingredients in their stock
- **Component**: `src/components/StockManager.tsx` — recipe-based ingredient index, search with synonym support, numeric quantity input
- **Data source**: Ingredients are sourced from recipe DB via `src/utils/ingredientIndex.ts` (no custom items). Default unit is auto-selected as most common non-適量 unit.
- **UI**: Search bar at top; in-stock items (quantity > 0) displayed in 50音順; search results shown below when searching
- **Stock query policy**: `db.stock` uses `.filter()` (not `.where()`) since stock table is small (~30-100 items). Recipes table must always use `.where()` with indexes.

### 2. Match Rate Calculation
- **Goal**: Calculate the percentage of recipe ingredients available in stock
- **Formula**: `(matched ingredients / total ingredients) * 100`

### 3. Match Rate Display
- **Goal**: Show the match rate on each `RecipeCard`
- **UI**: Display badge with "在庫 {matchRate}%" when `matchRate` is defined

### 4. Sort by Match Rate
- **Goal**: Sort search results by match rate in descending order

---

## UI Design Guidelines

### 1. Header with Search Bar
- **Component**: `src/components/SearchBar.tsx`
- **Features**: Search input with `Search` icon

### 2. Home Page Layout
- **Component**: `src/pages/HomePage.tsx` (在庫でつくれるレシピ + 旬のおすすめ + ウェルカム表示)
- **在庫でつくれるレシピ**: Stock-based recipe recommendations (via `geminiRecommender.ts`)
- **旬の食材セクション**: Display seasonal ingredients with recipe suggestions based on current month

### 3. Bottom Navigation (5 Tabs)
- **Component**: `src/components/BottomNav.tsx`
- **Tabs**: ホーム (Home), 検索 (Search), 在庫 (Package), お気に入り (Star), 履歴 (History)

### 4. App Structure
- **Component**: `src/App.tsx`
- **Router**: Use React Router to switch between pages

---

## Favorites Feature Implementation

### 1. Database Schema
- **Table**: `favorites` with unique `recipeId` field

### 2. Add/Remove Logic
- **Function**: `toggleFavorite(recipeId)` in `src/utils/favoritesUtils.ts`
- Check if exists → delete, else → add

### 3. UI Integration
- **Icon**: `Star` from `lucide-react`, filled when favorited
- **Components**: `RecipeDetail.tsx`, `RecipeCard.tsx`

### 4. Favorites Page
- **Component**: `src/pages/FavoritesPage.tsx`
- **Logic**: Get all favorite IDs, then fetch corresponding recipes

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
- **PWA Implementation**: Use `vite-plugin-pwa` with `registerType: 'autoUpdate'`. Service Worker handles offline caching, especially for external recipe images (`cocoroplus.jp.sharp`) via `CacheFirst` strategy.
- **PWA Name**: "Kitchen App"

### 3.1 iOS Viewport
- **maximum-scale=1**: Always set `maximum-scale=1` in viewport meta to prevent user zoom (ensures consistent mobile UI).

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

## iPhone 13+ & iOS 18 Compatibility

### Target Devices & OS
- **Devices**: iPhone 13, 13 Pro, 13 Pro Max, 14 series, 15 series, 16 series
- **OS**: iOS 18.x

### Device-Specific Optimizations

- **Dynamic Island (iPhone 14 Pro+)**: Use `env(safe-area-inset-top)` to avoid content overlap.
- **120Hz ProMotion (Pro models)**: Use `requestAnimationFrame` for smooth animations.
- **Responsive Design**: Support screen sizes from 6.1" to 6.7".

### Testing Environment
- **iPhone 13 (iOS 18)**: Standard model
- **iPhone 15 Pro (iOS 18)**: Dynamic Island + 120Hz
- **iPhone 16 Pro (iOS 18)**: Latest model

---

## Code Style Preferences

- Use `useLiveQuery` for reactive database queries
- Keep components small and focused (single responsibility)
- Extract complex calculations to `src/utils/` as pure functions
- Type everything strictly (no `any` types)
- **DB Initialization**: `initDb()` is called exactly once at the App component level (BrowserRouter の外). Individual page components must NOT call `initDb()` independently.
- **Routing**: Uses `Outlet` + nested routes pattern in `App.tsx`. Main tabs (home, search, stock, favorites, history) are nested under `AppLayout`.
- **Input Font Size**: All `<input>`, `<select>`, `<textarea>` elements must use `font-size: 16px` or larger to prevent iOS auto-zoom.
- **Known Limitation**: Gemini API キーは localStorage に保存。個人利用前提のため許容するが、共有環境では注意が必要。

---

## Memory Budget Guidelines

- **Per-page data**: Keep <1MB in memory at any time
- **Image storage**: Store URLs only, not blobs (IndexedDB has 50MB limit on Safari)
- **AI parsing**: Clear DOM after extracting text from fetched HTML

---

## Recipe Data: Pre-build Strategy

Recipe data is loaded via a **pre-build pipeline**, not runtime CSV import.

### Pipeline

1. **Build-time**: `scripts/prebuild-recipes.mjs` reads CSV files → outputs JSON to `src/data/`
2. **Bundle**: JSON files are imported at compile time and bundled into the app
3. **Runtime**: `initDb()` checks if DB is empty → bulk-inserts JSON data on first launch

### Data Sources

| Device | CSV File | Recipes | Notes |
|--------|----------|---------|-------|
| Hotcook (KN-HW24H) | `KN-HW24H_recipes_complete_complete.csv` | ~350 | Has menu number |
| Healsio (AX-XA20) | `AX-XA20_recipes_complete.csv` | ~1,372 | Has salt content, no menu number |

### Key Design Decisions

- **No runtime CSV import**: The `ImportPage` has been removed. All data is pre-built.
- **JSON files are git-tracked**: They are build artifacts but committed for reproducibility.
- **Image URLs**: External (`cocoroplus.jp.sharp`), cached via Service Worker for offline access.

---

## Image Handling

- **Storage**: `imageUrl` (string) のみ IndexedDB に保存。画像 blob は保存しない。
- **Source**: 外部 CDN (`cocoroplus.jp.sharp`) からロード。Service Worker の CacheFirst 戦略でオフラインキャッシュ。
- **Component**: `src/components/RecipeImage.tsx` — エラー時はフォールバックアイコン表示。
- **AI Parser**: URL からレシピ抽出時に JSON-LD / OGP から画像 URL も取得して `imageUrl` に保存。

---

## Phase E Features

- **ヘルシオデリ検出**: `isHelsioDeli()` in `recipeUtils.ts` — detects pre-made meal kit recipes by title/steps keywords, sorted to bottom of search results
- **JSON-LD/OGP parsing**: `geminiParser.ts` extracts structured data from recipe URLs before falling back to AI parsing
- **重複チェック**: AI parser checks for duplicate recipes by title before saving

---

## Recommendation Algorithms

### 1. Weather Comfort Score — `computeWeatherComfortScore`

**File**: `src/utils/season-weather/weatherScoring.ts`

Scores a single recipe against today's weather on a 0–1 scale. Used in the "今日食べたい料理" section.

```
weatherComfortScore = 0.45 × thermalFit(recipe, weather)
                    + 0.30 × cookingLoadFit(recipe, weather)
                    + 0.25 × shoppingBurdenFit(recipe, weather)
```

**thermalFit (45%)** — title keyword match vs temperature:

| Condition | Score |
|---|---|
| maxTempC ≥ 28 AND title matches `冷\|サラダ\|さっぱり` | 1.0 |
| maxTempC ≥ 28 AND title matches `煮込み\|鍋` | 0.3 |
| maxTempC ≥ 28 otherwise | 0.6 |
| maxTempC ≤ 12 AND title matches `煮込み\|鍋\|スープ` | 1.0 |
| maxTempC ≤ 12 AND title matches `冷\|サラダ` | 0.4 |
| 12°C < maxTempC < 28°C / ≤12 otherwise | 0.7 |

**cookingLoadFit (30%)** — `totalTimeMinutes` vs temperature (null → treated as 30 min):

| Condition | Score |
|---|---|
| maxTempC ≥ 30 AND totalTimeMinutes ≤ 20 | 1.0 |
| maxTempC ≥ 30 AND totalTimeMinutes > 20 | 0.5 |
| maxTempC < 30 AND totalTimeMinutes ≤ 40 | 0.8 |
| maxTempC < 30 AND totalTimeMinutes > 40 | 0.6 |

**shoppingBurdenFit (25%)** — main-category ingredient count vs precipitation:

| Condition | Score |
|---|---|
| precipitationMm < 5 (clear/cloudy) | 0.7 (fixed) |
| precipitationMm ≥ 5 AND main ingredients ≤ 5 | 1.0 |
| precipitationMm ≥ 5 AND main ingredients > 5 | 0.6 |

`main ingredients` = `ingredients[].category === 'main'` count (seasonings excluded).

**Weather data source**: JMA Forecast API (`https://www.jma.go.jp/bosai/forecast/data/forecast/130000.json`) — Tokyo area. Falls back to `buildSyntheticForecast` (month-average based synthetic 7 days) when unavailable.

---

### 2. Today's Recipe Score — `findTodayRecipes`

**File**: `src/pages/HomePage.tsx`

Combines weather comfort with seasonal ingredient match to rank recipes for the "今日食べたい料理" 2×2 tile section.

```
todayScore = 0.5 × weatherComfortScore + 0.5 × seasonalScore
```

| Component | Weight | Description |
|---|---|---|
| `weatherComfortScore` | 50% | Output of `computeWeatherComfortScore` (0–1) |
| `seasonalScore` | 50% | 1 if any ingredient name contains a seasonal ingredient string, else 0 |

- Recipes flagged as ヘルシオデリ (`isHelsioDeli()`) are excluded.
- Top 4 recipes by `todayScore` descending are displayed.
- If weather data is unavailable, falls back to seasonal-only filter (top 4).
- Seasonal ingredients: `getCurrentSeasonalIngredients(limit=10)` — picks 10 from a 24-item monthly pool using day-of-year as rotation seed (`src/data/seasonalIngredients.ts`).

---

### 3. Stock-Based Recommendation — `getLocalRecommendations`

**File**: `src/utils/geminiRecommender.ts`

Ranks recipes by the proportion of their ingredients currently in stock. Fully offline — no API call.

```
matchRate = (ingredients present in stock / total ingredients) × 100
```

- Loads up to 200 recipes (`db.recipes.limit(200).toArray()`); excludes ヘルシオデリ.
- Queries `db.stock` with `.filter(item => item.inStock)` (table is small ≤100 rows).
- Excludes recipes with `matchRate === 0`.
- Returns top 4 recipes sorted by `matchRate` descending.
- Displayed only when the user has at least one stock item.

---

### 4. Search Preference Rank — Kitchen App Preference Rank

**File**: `src/utils/searchUtils.ts`

Composite search score combining text relevance, user preference history, and stock match rate.

```
searchScore = textRelevance + preferenceBonus + stockMatchBonus
```

- **textRelevance**: Fuse.js fuzzy score against title/category/device/ingredients
- **preferenceBonus**: Weighted sum of view history, favorites, and weekly menu adoption history
- **stockMatchBonus**: Partial credit based on `matchRate` from stock items


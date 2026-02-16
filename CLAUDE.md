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
- **Weight rounding**: Calculate values retain decimal precision (1dp). Display rounds to nearest 1g (values <1g also round)
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
- **Estimated card height**: 150px

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
- **API**: Intersection Observer API
- **Placeholder**: `/placeholder.png`

### 🚀 Offload heavy computations to Web Workers
- **Goal**: Keep the UI thread responsive by moving heavy JS tasks to a background thread
- **Target**: Match rate calculation, complex filtering
- Use `new Worker(new URL('../workers/matchRate.worker.ts', import.meta.url))`

### 🚀 React 19 Concurrent Features
- **Goal**: Improve UI responsiveness during state updates
- **APIs**: `useTransition` for non-urgent updates, `useDeferredValue` for delaying re-renders
- **Target**: Search input, heavy component re-renders

### 🚀 Optimize Tailwind CSS
- **Goal**: Reduce CSS bundle size by purging unused styles
- Ensure `tailwind.config.js` includes all source files in `content` array

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
- Encode images to BlurHash strings, store in `imageBlurHash` field

### 5. Image Optimization Checklist
- [ ] Add `imageUrl?`, `thumbnailUrl?`, `imageBlurHash?` to Recipe interface
- [ ] Update CSV import to handle image URLs
- [ ] Create `RecipeImage` component with error handling
- [ ] Install and configure `react-blurhash`
- [ ] Test with recipes that have no images

### 6. Database Migration
- When adding image fields, use Dexie schema versioning to avoid breaking existing data

```typescript
// src/db/db.ts
this.version(2).stores({
  recipes: '++id, title, device, category, imageUrl'
})
```

### 7. AI Parsing for Images
- When AI extracts recipes from URLs, it should also identify the main recipe image (e.g., from Open Graph tags or schema.org metadata) and save its URL to the `imageUrl` field

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

### 1. Stock Selector UI
- **Goal**: Allow users to select ingredients from their stock
- **Component**: `src/components/StockSelector.tsx` with button list

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
- **Component**: `src/components/SearchHeader.tsx`
- **Features**: Search input with `Search` icon, notification `Bell` icon

### 2. Home Page Layout
- **Component**: `src/pages/HomePage.tsx`
- **Layout**: `SearchHeader` + "至高のカテゴリー" section + `CategoryGrid` + "その他のカテゴリー" section + `IconGrid`
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

### Performance on A15 Bionic & Newer

- **Web Workers**: Use `type: 'module'` for ES module support (iOS 26+).
- **Memory Management**: Monitor usage and clear old caches.
- **Haptic Feedback**: Use `navigator.vibrate(10)` for enhanced touch interactions.

### Testing Environment
- **iPhone 13 (iOS 26.2.1)**: Standard model
- **iPhone 15 Pro (iOS 26.2.1)**: Dynamic Island + 120Hz
- **iPhone 17 Pro (iOS 26.2.1)**: Latest model

---

## Code Style Preferences

- Use `useLiveQuery` for reactive database queries
- Keep components small and focused (single responsibility)
- Extract complex calculations to `src/utils/` as pure functions
- Type everything strictly (no `any` types)
- **DB Initialization**: `initDb()` is called exactly once at the app entry point (`AppShell`). Individual page components must NOT call `initDb()` independently.
- **Routing**: Future migration to `Outlet` + nested routes pattern recommended (currently uses `activeTab` + `navigate()` dual management).
- **Input Font Size**: All `<input>`, `<select>`, `<textarea>` elements must use `font-size: 16px` or larger to prevent iOS auto-zoom.

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

## Image Handling Strategy (Future-Proof)

**Target data scale**: ~2000 recipes, each with a high-resolution image

### 1. Storage Strategy: URL-based, Cache on Demand

- **Database**: Store only the `imageUrl` (string) in IndexedDB. **NEVER store image blobs**.
- **Image Source**: Images are hosted on an external CDN or web server.
- **Loading**: When a recipe is opened, the image is downloaded from the `imageUrl`.
- **Caching**: Downloaded images are cached using the **Cache API** (part of Service Workers). This allows for offline access without filling up IndexedDB.
- **Cache Eviction**: Implement a **Least Recently Used (LRU)** cache eviction policy to manage storage. For example, keep the last 100 viewed images.

### 2. UI Implementation: Placeholder & Progressive Loading

- **Placeholder**: While the image is downloading, display a placeholder to prevent layout shifts. This can be a simple gray box with the correct aspect ratio, or a low-quality image placeholder (LQIP) like a BlurHash string.
- **Progressive Loading**: First, show the low-quality placeholder. Once the high-resolution image is downloaded, fade it in for a smooth user experience.

### 3. AI Recipe Parser Enhancement

- The AI parser, when extracting recipes from URLs, should also identify the main recipe image (e.g., from Open Graph tags or schema.org metadata) and save its URL to the `imageUrl` field.

---

## Performance Optimization for iPhone

To ensure the app runs smoothly on all target iPhones (13 and newer), focus on these critical optimizations.

### 1. Virtual Scrolling (Essential for 2000+ recipes)

- **Problem**: Rendering a list of 2000 recipes crashes the browser.
- **Solution**: Use `@tanstack/react-virtual` (see Advanced Performance Techniques section)
- **Impact**: Only renders the ~10 items visible on screen, keeping the app fast and responsive.

### 2. Offload Heavy Computations to Web Workers

- **Problem**: Complex calculations like fuzzy search or match rate sorting can freeze the UI.
- **Solution**: Move these tasks to a background thread using Web Workers.
- **Impact**: The UI remains interactive and smooth even during heavy processing.

### 3. Judicious Use of `React.memo` and `useMemo`

- **Problem**: Unnecessary re-renders of complex components like `RecipeCard` can slow down the app.
- **Solution**: Wrap `RecipeCard` in `React.memo` and use `useMemo` for expensive calculations within components.

### 4. CSS Containment for Rendering Performance

- **Problem**: The browser recalculates the layout for the entire page on every change.
- **Solution**: Use the `contain` CSS property on `RecipeCard` to isolate its rendering from the rest of the page.

```css
.recipe-card {
  contain: layout style paint;
}
```

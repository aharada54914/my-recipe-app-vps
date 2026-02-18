# Architecture Reference

Technical documentation covering the database schema, component structure, API integrations, and sync system.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Database Schema](#2-database-schema)
3. [Component Map](#3-component-map)
4. [State Management](#4-state-management)
5. [Sync System](#5-sync-system)
6. [API Integrations](#6-api-integrations)
7. [Recipe Data Pipeline](#7-recipe-data-pipeline)
8. [Performance Guidelines](#8-performance-guidelines)
9. [Routing](#9-routing)

---

## 1. Project Structure

```
my-recipe-app/
├── src/
│   ├── App.tsx                   # Root component, router, context providers, initDb()
│   ├── index.css                 # Global styles, --vh fix, CSS containment rules
│   │
│   ├── components/               # Reusable UI components
│   │   ├── BottomNav.tsx         # 5-tab bottom navigation
│   │   ├── CalendarRegistrationModal.tsx
│   │   ├── CalendarSettings.tsx
│   │   ├── CategoryGrid.tsx
│   │   ├── Header.tsx
│   │   ├── MealPlanSettings.tsx
│   │   ├── NotificationSettings.tsx
│   │   ├── RecipeCard.tsx
│   │   ├── RecipeDetail.tsx      # Full recipe view
│   │   ├── RecipeImage.tsx       # Lazy-loaded image with fallback
│   │   ├── ScheduleGantt.tsx
│   │   ├── SearchBar.tsx
│   │   ├── ServingAdjuster.tsx
│   │   ├── WeeklyMenuTimeline.tsx
│   │   └── ...
│   │
│   ├── pages/                    # Route-level page components
│   │   ├── HomePage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── WeeklyMenuPage.tsx
│   │
│   ├── contexts/                 # React Context providers
│   │   ├── AuthContext.tsx       # Google OAuth state (user, providerToken)
│   │   ├── authContextDef.ts     # AuthContext type definition
│   │   ├── PreferencesContext.tsx # User preferences state
│   │   └── preferencesContextDef.ts
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── usePreferences.ts
│   │   └── useSync.ts
│   │
│   ├── db/
│   │   └── db.ts                 # Dexie schema, all type definitions, initDb()
│   │
│   ├── lib/                      # External service clients
│   │   ├── supabase.ts           # Supabase client init
│   │   ├── googleCalendar.ts     # Google Calendar API v3 wrappers
│   │   └── database.types.ts     # Generated Supabase TypeScript types
│   │
│   ├── utils/                    # Pure functions and business logic
│   │   ├── recipeUtils.ts        # formatQuantityVibe, adjustIngredients, isHelsioDeli
│   │   ├── syncManager.ts        # Full bidirectional sync logic
│   │   ├── syncConverters.ts     # Local ↔ cloud type converters
│   │   ├── weeklyMenuSelector.ts # Scoring algorithm for weekly menu generation
│   │   ├── weeklyMenuCalendar.ts # Calendar registration for weekly menus
│   │   ├── weeklyShoppingUtils.ts # Aggregate ingredients across a week
│   │   ├── geminiParser.ts       # AI recipe extraction from URLs
│   │   ├── geminiWeeklyMenu.ts   # Gemini refinement for weekly menus
│   │   ├── geminiRecommender.ts  # Stock-based local recipe recommendations
│   │   ├── familyCalendarUtils.ts # (Reserved for family features)
│   │   ├── ingredientIndex.ts    # Build ingredient index from recipe DB
│   │   ├── favoritesUtils.ts     # toggleFavorite()
│   │   ├── shoppingUtils.ts      # getMissingIngredients, formatShoppingListForLine
│   │   ├── dataExport.ts         # JSON export
│   │   ├── dataImport.ts         # JSON import (merge / overwrite)
│   │   └── csvParser.ts          # CSV parsing helpers (shared with prebuild script)
│   │
│   └── data/                     # Static data files
│       ├── recipes-hotcook.json  # Pre-built Hotcook recipe data (~350 recipes)
│       ├── recipes-healsio.json  # Pre-built Healsio recipe data (~1,372 recipes)
│       ├── seasonalIngredients.ts # Monthly seasonal ingredient map
│       └── synonyms.ts           # Ingredient name synonym map
│
├── scripts/
│   └── prebuild-recipes.mjs     # CSV → JSON pipeline (runs before npm run build)
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── 002_rls_policies.sql
│
├── public/                       # Static assets (icons, manifest)
├── .env.example
├── vite.config.ts
└── package.json
```

---

## 2. Database Schema

**Engine:** Dexie.js 4.3 (IndexedDB wrapper)
**Database name:** `RecipeDB`
**Schema version:** 8

### recipes

```
indexes: ++id, title, device, category, recipeNumber, [category+device], imageUrl, supabaseId
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` (auto) | Local primary key |
| `title` | `string` | Recipe name |
| `recipeNumber` | `string` | e.g. `HC-001`, `HS-042` |
| `device` | `'hotcook' \| 'healsio' \| 'manual'` | Cooking appliance |
| `category` | `RecipeCategory` | 主菜 / 副菜 / スープ / ご飯もの / デザート |
| `baseServings` | `number` | Default servings (usually 2) |
| `totalWeightG` | `number` | Estimated total ingredient weight (g) |
| `ingredients` | `Ingredient[]` | Parsed ingredient list |
| `steps` | `CookingStep[]` | Parsed cooking phases |
| `totalTimeMinutes` | `number` | Total cooking time |
| `sourceUrl` | `string?` | Original recipe URL |
| `servings` | `string?` | Original servings string from CSV |
| `calories` | `string?` | Calorie content |
| `saltContent` | `string?` | Salt percentage (Healsio only) |
| `cookingTime` | `string?` | Original time string |
| `rawSteps` | `string[]?` | Raw step-by-step text |
| `imageUrl` | `string?` | External CDN image URL |
| `supabaseId` | `string?` | Cloud record UUID |
| `updatedAt` | `Date?` | Last modification timestamp |

### stock

```
indexes: ++id, &name, inStock, supabaseId
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` (auto) | Local primary key |
| `name` | `string` (unique) | Ingredient name |
| `inStock` | `boolean` | quantity > 0 |
| `quantity` | `number?` | Amount (e.g., 500 for 500 g) |
| `unit` | `string?` | Unit: g / ml / 個 / etc. |
| `supabaseId` | `string?` | Cloud record UUID |
| `updatedAt` | `Date?` | Last modification timestamp |

### favorites

```
indexes: ++id, &recipeId, addedAt, supabaseId
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` (auto) | |
| `recipeId` | `number` (unique) | FK → recipes.id |
| `addedAt` | `Date` | When favorited |
| `supabaseId` | `string?` | |

### userNotes

```
indexes: ++id, &recipeId, updatedAt, supabaseId
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` (auto) | |
| `recipeId` | `number` (unique) | FK → recipes.id |
| `content` | `string` | Free-form cooking notes |
| `updatedAt` | `Date` | |
| `supabaseId` | `string?` | |

### viewHistory

```
indexes: ++id, recipeId, viewedAt, supabaseId
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` (auto) | |
| `recipeId` | `number` | FK → recipes.id |
| `viewedAt` | `Date` | When the recipe detail was opened |
| `supabaseId` | `string?` | |

### calendarEvents

```
indexes: ++id, recipeId, googleEventId, supabaseId
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` (auto) | |
| `recipeId` | `number` | FK → recipes.id |
| `googleEventId` | `string` | Google Calendar event ID |
| `calendarId` | `string` | Target Google Calendar ID |
| `eventType` | `'meal' \| 'shopping'` | |
| `startTime` | `Date` | |
| `endTime` | `Date` | |
| `createdAt` | `Date` | |
| `supabaseId` | `string?` | |

### userPreferences

```
indexes: ++id, supabaseId
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `familyCalendarId` | `string?` | — | Default sync calendar |
| `mealStartHour/Minute` | `number` | 19:00 | Meal event start time |
| `mealEndHour/Minute` | `number` | 20:00 | Meal event end time |
| `defaultCalendarId` | `string?` | — | Primary Google Calendar |
| `weeklyMenuGenerationDay` | `number` | 0 | Day of week (0=Sun) for auto-generation |
| `weeklyMenuGenerationHour/Minute` | `number` | 8:00 | Time for auto-generation |
| `shoppingListHour/Minute` | `number` | 9:00 | Shopping list reminder time |
| `seasonalPriority` | `'low' \| 'medium' \| 'high'` | `'medium'` | Seasonal ingredient weight |
| `userPrompt` | `string` | `''` | Custom Gemini prompt hint |
| `notifyWeeklyMenuDone` | `boolean` | `false` | |
| `notifyShoppingListDone` | `boolean` | `false` | |
| `cookingNotifyEnabled` | `boolean` | `false` | |
| `cookingNotifyHour/Minute` | `number` | 18:30 | Cooking start reminder time |
| `desiredMealHour/Minute` | `number` | 19:00 | Target "いただきます" time for Gantt |
| `updatedAt` | `Date` | | |
| `supabaseId` | `string?` | | |

### weeklyMenus

```
indexes: ++id, weekStartDate, supabaseId
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` (auto) | |
| `weekStartDate` | `string` | `'YYYY-MM-DD'` (Sunday) |
| `items` | `WeeklyMenuItem[]` | 7 daily recipes |
| `shoppingList` | `string?` | Cached shopping list text |
| `status` | `'draft' \| 'confirmed' \| 'registered'` | |
| `createdAt` | `Date` | |
| `updatedAt` | `Date` | |
| `supabaseId` | `string?` | |

### Key Types

```typescript
type DeviceType = 'hotcook' | 'healsio' | 'manual'
type RecipeCategory = 'すべて' | '主菜' | '副菜' | 'スープ' | 'ご飯もの' | 'デザート'
type SeasonalPriority = 'low' | 'medium' | 'high'
type WeeklyMenuStatus = 'draft' | 'confirmed' | 'registered'

interface Ingredient {
  name: string
  quantity: number
  unit: string
  category: 'main' | 'sub'
  optional?: boolean
}

interface CookingStep {
  name: string
  durationMinutes: number
  isDeviceStep?: boolean
}

interface WeeklyMenuItem {
  recipeId: number
  date: string          // 'YYYY-MM-DD'
  mealType: 'dinner'
  locked: boolean
}
```

---

## 3. Component Map

### Pages (route-level)

| Component | Route | Description |
|-----------|-------|-------------|
| `HomePage` | `/` | Category grid, weekly preview, stock recommendations |
| `RecipeList` (via SearchPage) | `/search` | Fuzzy search with filters and virtual scroll |
| `StockManager` | `/stock` | Ingredient stock management |
| `FavoritesPage` | `/favorites` | Bookmarked recipes |
| `HistoryPage` | `/history` | View history (200 records) |
| `WeeklyMenuPage` | `/weekly-menu` | 7-day meal plan UI |
| `RecipeDetail` | `/recipe/:id` | Full recipe view |
| `AiRecipeParser` | `/ai-parse` | URL-based AI recipe import |
| `MultiScheduleView` | `/multi-schedule` | Parallel Gantt view |
| `SettingsPage` | `/settings` | All settings |

### Shared Components

| Component | Key Props / Behavior |
|-----------|----------------------|
| `RecipeCard` | recipe, matchRate, onClick — shows device badge and match rate badge |
| `RecipeImage` | url, alt — native `loading="lazy"`, fallback icon on error |
| `BottomNav` | activeTab — 5 tabs with safe-area-inset-bottom |
| `Header` | title, actions — buttons for AI parse / multi-schedule / settings |
| `SearchBar` | value, onChange — debounced input with search icon |
| `ServingAdjuster` | servings, onChange — ＋/－ with direct input |
| `ScheduleGantt` | recipe, desiredMealTime — backward-calculated timeline |
| `WeeklyMenuTimeline` | menu, compact — 7-day cards or compact row |
| `CalendarRegistrationModal` | recipeId, onClose — calendar picker + time setter |
| `CalendarSettings` | prefs, onSave — calendar ID + meal time inputs |
| `MealPlanSettings` | prefs, onSave — generation schedule + seasonal priority + prompt |
| `NotificationSettings` | prefs, onSave — notification toggles + times |
| `CategoryGrid` | onSelect — 6 category quick-filter buttons |

---

## 4. State Management

### React Context

| Context | Provided by | Consumed via |
|---------|------------|--------------|
| `AuthContext` | `AuthContext.tsx` | `useAuth()` |
| `PreferencesContext` | `PreferencesContext.tsx` | `usePreferences()` |
| SyncProvider (in App.tsx) | `useSync.ts` internal | `useSync()` |

**Context tree** (in `App.tsx`):

```
<AuthContext.Provider>
  <PreferencesContext.Provider>
    <SyncProvider>
      <BrowserRouter>
        <AppLayout>  ← Outlet + BottomNav
          <Routes />
        </AppLayout>
      </BrowserRouter>
    </SyncProvider>
  </PreferencesContext.Provider>
</AuthContext.Provider>
```

`initDb()` is called **once** at the `App` component level, outside `BrowserRouter`.
Individual pages must **not** call `initDb()` independently.

### Reactive DB queries

Use `useLiveQuery` from `dexie-react-hooks` for all reactive database reads.

```typescript
// Always apply a limit to prevent loading all recipes into memory
const recipes = useLiveQuery(() =>
  db.recipes.where('category').equals(category).limit(200).toArray(),
  [category]
)

// Combine related queries to avoid redundant DB scans
const [hotcook, healsio] = useLiveQuery(() =>
  Promise.all([
    db.recipes.where('device').equals('hotcook').limit(100).toArray(),
    db.recipes.where('device').equals('healsio').limit(100).toArray(),
  ]),
  [],
  [[], []]
) ?? [[], []]
```

---

## 5. Sync System

**Strategy:** Full-table bidirectional sync (not differential).
**Trigger:** Manual via "今すぐ同期" button in Settings.
**Conflict resolution:** Last-write-wins based on `updated_at`.

### Sync order (respects foreign key dependencies)

```
1. recipes        ← referenced by favorites, userNotes, viewHistory, calendarEvents, weeklyMenus
2. stock          ← independent
3. favorites      ← needs recipeId mapping
4. userNotes      ← needs recipeId mapping
5. viewHistory    ← needs recipeId mapping (limited to 200)
6. calendarEvents ← needs recipeId mapping
7. userPreferences ← single record per user
8. weeklyMenus    ← needs recipeId mapping inside items[]
```

### Sync logic per table

Each table follows this pattern:

**PUSH (local → cloud):**
1. Find local records without `supabaseId` → upsert to Supabase → store returned UUID as `supabaseId`
2. Find local records with `supabaseId` + recent `updatedAt` → upsert to Supabase

**PULL (cloud → local):**
1. Fetch all records for this `user_id` from Supabase
2. For records not in local DB → insert
3. For records in both → compare `updated_at`, apply cloud version if newer

### Data converters (`src/utils/syncConverters.ts`)

Every table has a pair of converter functions:

```typescript
recipeToCloud(recipe: Recipe, userId: string): CloudRecipe
recipeFromCloud(row: CloudRecipe): Recipe

stockToCloud(item: StockItem, userId: string): CloudStock
stockFromCloud(row: CloudStock): StockItem

// ... same pattern for favorites, userNotes, viewHistory,
//     calendarEvents, userPreferences, weeklyMenus
```

---

## 6. API Integrations

### Gemini API

**Model:** `gemini-2.0-flash`
**Key source:** `VITE_GEMINI_API_KEY` env var → `localStorage['gemini_api_key']`

| Use case | File | Description |
|----------|------|-------------|
| Recipe parsing | `geminiParser.ts` | Extract structured recipe data from a URL |
| Weekly menu refinement | `geminiWeeklyMenu.ts` | Optimize a locally-generated plan for nutrition/variety |
| Stock recommendations | `geminiRecommender.ts` | Rank recipes by stock match (local scoring, no API call for basic mode) |

**Recipe parsing flow:**

```
URL input
  → fetch page HTML
  → try JSON-LD / OGP extraction (no AI)
  → if incomplete → Gemini prompt with extracted text
  → parse JSON response → Recipe object
  → duplicate title check
  → save to db.recipes
```

### Supabase

**Client:** `src/lib/supabase.ts`
Returns `null` if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is not set (graceful degradation).

**Authentication:**
- `supabase.auth.signInWithOAuth({ provider: 'google', scopes: 'calendar.events calendar.readonly' })`
- `provider_token` from the session is used directly for Google Calendar API calls.

**Tables** (see `supabase/migrations/001_initial_schema.sql`):
- `recipes`, `stock`, `favorites`, `user_notes`, `view_history`, `calendar_events`, `user_preferences`, `weekly_menus`
- All tables have a `user_id` column (UUID, FK to `auth.users`)

**RLS policies** (see `supabase/migrations/002_rls_policies.sql`):
- Each table is restricted to `auth.uid() = user_id` — users can only read/write their own data.

### Google Calendar API v3

**Base URL:** `https://www.googleapis.com/calendar/v3`
**Auth:** Bearer token (`providerToken` from Supabase OAuth session)

| Function | HTTP call | Description |
|----------|-----------|-------------|
| `listCalendars(token)` | `GET /users/me/calendarList` | List available calendars |
| `createCalendarEvent(token, calId, event)` | `POST /calendars/{calId}/events` | Create an event |
| `deleteCalendarEvent(token, calId, eventId)` | `DELETE /calendars/{calId}/events/{eventId}` | Delete an event |
| `listEvents(token, calId, timeMin, timeMax)` | `GET /calendars/{calId}/events` | List events in a time range |

**Meal event format:**

```json
{
  "summary": "夕食: チキンカレー",
  "description": "材料:\n・鶏肉 300g\n・玉ねぎ 1個\n\nレシピ: https://...",
  "start": { "dateTime": "2026-02-18T19:00:00", "timeZone": "Asia/Tokyo" },
  "end":   { "dateTime": "2026-02-18T20:00:00", "timeZone": "Asia/Tokyo" },
  "reminders": { "useDefault": false, "overrides": [{ "method": "popup", "minutes": 30 }] }
}
```

---

## 7. Recipe Data Pipeline

### Overview

Recipe data is **pre-built at build time**, not imported at runtime.

```
CSV files (repo root)
  ↓  scripts/prebuild-recipes.mjs  (Node.js, runs via npm run prebuild)
src/data/recipes-hotcook.json
src/data/recipes-healsio.json
  ↓  imported by src/db/db.ts at compile time
  ↓  bundled into the app by Vite
  ↓  bulk-inserted by initDb() on first launch (if DB is empty)
```

### CSV sources

| File | Device | Recipes | Notable fields |
|------|--------|---------|----------------|
| `KN-HW24H_recipes_complete_complete.csv` | Hotcook | ~350 | Has menu number |
| `AX-XA20_recipes_complete.csv` | Healsio | ~1,372 | Has salt content %, no menu number |

### Prebuild script (`scripts/prebuild-recipes.mjs`)

**Parsing logic:**
- **Ingredients:** Split by newline → parse `"name: quantity unit"` format
  - Category auto-detection: `sub` if name matches 醤油/塩/砂糖/etc., else `main`
  - Quantity: supports fractions (`1/2`, `大さじ1と1/2`), units (g, ml, 個, 大さじ, 小さじ)
  - Fallback: `quantity: 0, unit: '適量'`
- **Category guessing:** Regex on title → スープ / ご飯もの / デザート / 副菜 / 主菜
- **Total weight:** Sum g/ml ingredients; countable items estimated at ~150 g each; rounded to 50 g
- **Cooking steps:**
  - Prep: 5–20 min (scales with ingredient count)
  - Device step: `cookingTime - prep - 3` min
  - Plating: fixed 3 min

---

## 8. Performance Guidelines

### Critical rules

| Rule | Reason |
|------|--------|
| Always `.limit(200)` on recipe queries | `db.recipes.toArray()` for 2,000 recipes loads 10–20 MB |
| Filter in Dexie, not JavaScript | JS filtering 2,000 items causes UI freezes on every keystroke |
| Debounce search input (300 ms) | Prevents excessive IndexedDB reads per keystroke |
| Use indexed `.where()` for recipes | Compound index `[category+device]` makes combined filters fast |
| Use `.filter()` for stock | Stock table stays small (~30–100 items); index overhead not worth it |

### Virtual scrolling

`@tanstack/react-virtual` with estimated row height of **88 px**.
Reduces DOM nodes by >95% for long recipe lists.

### CSS containment (applied globally in `index.css`)

```css
.recipe-card {
  contain: layout style paint;
  content-visibility: auto;
  contain-intrinsic-size: auto 88px;
}
```

### React 19 concurrent features

- `useTransition` — wrap non-urgent state updates (e.g., filter changes) to keep the UI responsive
- `useDeferredValue` — delay heavy list re-renders during rapid search input

### Memory budget

| Area | Limit |
|------|-------|
| Recipes in memory at once | < 200 |
| Per-page data | < 1 MB |
| Image storage | URLs only (no blobs) — Safari IndexedDB limit is ~50 MB |
| View history in cloud sync | 200 records max |

---

## 9. Routing

Uses React Router 7 with the **Outlet + nested routes** pattern.

```
<BrowserRouter>
  <Route path="/" element={<AppLayout />}>   ← renders BottomNav + <Outlet />
    <Route index element={<HomePage />} />
    <Route path="search" element={<RecipeList />} />
    <Route path="stock" element={<StockManager />} />
    <Route path="favorites" element={<FavoritesPage />} />
    <Route path="history" element={<HistoryPage />} />
    <Route path="weekly-menu" element={<WeeklyMenuPage />} />
    <Route path="recipe/:id" element={<RecipeDetail />} />
    <Route path="ai-parse" element={<AiRecipeParser />} />
    <Route path="multi-schedule" element={<MultiScheduleView />} />
    <Route path="settings" element={<SettingsPage />} />
  </Route>
</BrowserRouter>
```

`AppLayout` renders the page content via `<Outlet />` and always shows `<BottomNav />` at the bottom.

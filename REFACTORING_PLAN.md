# Refactoring Plan — Implementation Status

## Goal

Add cloud sync, Google Calendar integration, AI-powered weekly meal planning, personal preferences,
weekly timeline display, and home screen improvements — all while preserving the existing UI and UX.

---

## Status Overview

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Supabase infrastructure | ✅ Complete |
| 2 | Google OAuth authentication | ✅ Complete |
| 3 | Data sync (auto every 5 min) | ✅ Complete |
| 4 | Google Calendar integration | ✅ Complete |
| 5 | User preferences / settings | ✅ Complete |
| 6 | Weekly menu auto-generation | ✅ Complete (auto-scheduler not yet automated) |
| 7 | Home screen improvements | ✅ Complete |
| 8 | Weekly menu timeline | ✅ Complete |
| 9 | PWA auto-update | ✅ Complete |
| 10 | Home/Search integration & category grid | ⚠️ Partial |
| 11 | Ingredients / Steps tab switching | ✅ Complete |
| 12 | Reverse schedule prep-time calculation | ✅ Complete |

---

## Phase 1 — Supabase Infrastructure ✅ Complete

**What was built:**
- `src/lib/supabase.ts` — Supabase client. Returns `null` if env vars are missing (graceful degradation).
- `supabase/migrations/001_initial_schema.sql` — Creates all 8 tables: `recipes`, `stock`, `favorites`, `user_notes`, `view_history`, `calendar_events`, `user_preferences`, `weekly_menus`.
- `supabase/migrations/002_rls_policies.sql` — Row Level Security so each user can only access their own data (`auth.uid() = user_id`).

---

## Phase 2 — Google OAuth Authentication ✅ Complete

**What was built:**
- `src/contexts/AuthContext.tsx` — Provides `user`, `providerToken`, `signInWithGoogle()`, `signOut()`.
- `src/contexts/authContextDef.ts` — Type definition for the context.
- `src/hooks/useAuth.ts` — Hook to consume `AuthContext`.
- Sign-in uses `supabase.auth.signInWithOAuth({ provider: 'google' })` with scopes `calendar.events` and `calendar.readonly`.
- The `provider_token` returned from Supabase is passed to Google Calendar API calls.
- Sign-out clears the session and disables calendar features.

---

## Phase 3 — Data Sync ✅ Complete

**What was built:**
- `src/utils/syncManager.ts` — Full bidirectional sync between Dexie.js (IndexedDB) and Supabase.
- `src/utils/syncConverters.ts` — Type converters for every table (local ↔ cloud).
- `src/hooks/useSync.ts` — `useSync()` hook exposing `syncNow()`, `isSyncing`, `lastSyncedAt`, `error`.
- **Auto-sync runs every 5 minutes** (`SYNC_INTERVAL_MS = 5 * 60 * 1000`) via `setInterval` in the hook.
- Manual sync button ("今すぐ同期") available in Settings.

**Sync order (respects FK dependencies):**
1. recipes → 2. stock → 3. favorites → 4. userNotes → 5. viewHistory → 6. calendarEvents → 7. userPreferences → 8. weeklyMenus

**Conflict resolution:** Last-write-wins based on `updated_at`.

---

## Phase 4 — Google Calendar Integration ✅ Complete

**What was built:**
- `src/lib/googleCalendar.ts` — Wrappers for Google Calendar API v3:
  - `listCalendars(token)` — Get user's available calendars
  - `createCalendarEvent(token, calendarId, event)` — Create an event
  - `deleteCalendarEvent(token, calendarId, eventId)` — Delete an event
  - `listEvents(token, calendarId, timeMin, timeMax)` — List events in range
  - `buildMealEventInput(...)` — Format a meal event payload
  - `buildShoppingListEventInput(...)` — Format a shopping list event payload
- `src/components/CalendarRegistrationModal.tsx` — Modal to select calendar, set time, and add reminders. Used from recipe detail.
- `src/utils/weeklyMenuCalendar.ts` — Bulk-register a 7-day meal plan: one meal event per day + one shopping list event the day before.
- `src/utils/familyCalendarUtils.ts` — Utilities for family calendar (reserved for future expansion).
- All created events are stored in `db.calendarEvents` and synced to Supabase.

**Meal event format:**
```
Summary:     夕食: <recipe title>
Description: 材料:\n・ingredient 1\n・ingredient 2\n\nレシピ: <source URL>
Start/End:   Based on user's preferred meal time (from preferences)
Reminder:    Optional popup N minutes before
```

---

## Phase 5 — User Preferences ✅ Complete

**What was built:**
- `db.userPreferences` table (version 8) in `src/db/db.ts` — single record per user.
- `src/contexts/PreferencesContext.tsx` + `src/hooks/usePreferences.ts` — reactive preference state.
- `src/components/CalendarSettings.tsx` — Calendar picker dropdown (fetched live from Google), meal start/end time, family calendar ID field.
- `src/components/MealPlanSettings.tsx` — Weekly generation schedule (day + time), seasonal priority (low/medium/high), free-text user prompt, desired meal time.
- `src/components/NotificationSettings.tsx` — Toggles and time inputs for: weekly menu done notification, shopping list done notification, cooking start reminder.
- All settings are saved to `db.userPreferences` and synced via Supabase.

**Available preference fields:**

| Field | Default | Description |
|-------|---------|-------------|
| `defaultCalendarId` | — | Primary Google Calendar for events |
| `familyCalendarId` | — | Family shared calendar ID |
| `mealStartHour/Minute` | 19:00 | Meal event start time |
| `mealEndHour/Minute` | 20:00 | Meal event end time |
| `desiredMealHour/Minute` | 19:00 | Target meal time for Gantt chart |
| `weeklyMenuGenerationDay/Hour/Minute` | Fri 18:00 | Schedule for auto-generation (UI only, not yet automated) |
| `seasonalPriority` | `medium` | Seasonal ingredient boost weight |
| `userPrompt` | `''` | Custom hint for Gemini (e.g., "avoid salty dishes") |
| `notifyWeeklyMenuDone` | false | Notification when menu is generated |
| `notifyShoppingListDone` | false | Notification when shopping list is ready |
| `cookingNotifyEnabled` | false | Cooking start reminder |
| `cookingNotifyHour/Minute` | 18:30 | When to send cooking start reminder |

---

## Phase 6 — Weekly Menu Auto-Generation ✅ Complete

> Note: The generation schedule UI is implemented but the actual scheduler (running automatically at the configured time) is not yet automated — generation is triggered manually.

**What was built:**
- `src/utils/weeklyMenuSelector.ts` — Local scoring algorithm for 7-day meal plan:
  - Stock match rate (weight ×3.0)
  - Seasonal ingredient bonus (weight ×0.5–3.0 based on `seasonalPriority`)
  - Recency penalty: −20 if used in the last 2 weeks
  - View history penalty: −5 if recently viewed
  - Category diversity: −10 per duplicate over 2
  - Device diversity: −5 per duplicate over 3
  - Device alternation bonus: +3 for switching device from previous day
- `src/utils/geminiWeeklyMenu.ts` — Optional Gemini pass to refine the locally-scored plan for nutrition and variety, using the user's custom prompt.
- `src/pages/WeeklyMenuPage.tsx` — Full UI:
  - "献立を自動生成" — generate a new plan
  - "再生成" — regenerate unlocked days only
  - Lock icon per day — prevent that day from being replaced
  - Swap icon (↻) per day — replace only that day
  - "買い物リスト" — aggregated weekly shopping list
  - "カレンダー登録" — register all 7 days to Google Calendar
- `src/utils/weeklyShoppingUtils.ts` — Aggregate ingredients across all 7 recipes; merge by name+unit, deduplicate 適量 items, sort by stock status.
- `db.weeklyMenus` table — stores the plan with status: `draft` | `confirmed` | `registered`.

**Not yet automated:**
- The `weeklyMenuGenerationDay/Hour/Minute` settings are saved but no background scheduler runs them. The user must tap "献立を自動生成" manually.

---

## Phase 7 — Home Screen Improvements ✅ Complete

**What was built (added to `src/pages/HomePage.tsx`):**
- **Category grid** (`CategoryGrid` component) — 8 quick-filter buttons at the top.
- **Compact weekly menu preview** (`WeeklyMenuTimeline` component in compact mode) — shows the current week's plan.
- **Stock-based recommendations** — recipes scored by match rate, displayed in a horizontal scroll row.
- **Seasonal picks (旬のおすすめ)** — recipes containing ingredients in-season for the current month, using data from `src/data/seasonalIngredients.ts`.

---

## Phase 8 — Weekly Menu Timeline ✅ Complete

**What was built:**
- `src/components/WeeklyMenuTimeline.tsx` — Timeline-style display of the 7-day meal plan:
  - Vertical timeline with a dot per day
  - Today highlighted with accent background
  - Previous / next week navigation buttons
  - Tapping a recipe card navigates to the recipe detail page
  - Reuses `RecipeCard` component
- **BottomNav updated:** The 検索 tab was replaced with a **献立** tab (`/weekly-menu`). Current tabs: ホーム, 献立, 在庫, お気に入り, 履歴.

---

## Phase 9 — PWA Auto-Update ✅ Complete

**What was built (`vite.config.ts`):**

| Setting | Value | Effect |
|---------|-------|--------|
| `registerType` | `'autoUpdate'` | New SW version activates without user prompt |
| `skipWaiting` | `true` | New SW takes control immediately |
| `clientsClaim` | `true` | New SW controls all open tabs instantly |
| `cleanupOutdatedCaches` | (Workbox default) | Old caches are removed on update |

Image caching strategy: `CacheFirst` for `cocoroplus.jp.sharp` CDN images (offline access).

---

## Phase 10 — Home/Search Integration & Category Grid ⚠️ Partial

**What was completed:**
- ✅ `src/components/CategoryGrid.tsx` created — 8-button grid with emoji icons, navigates to `/search?filter=<value>`.
- ✅ `CategoryGrid` added to `HomePage.tsx`.
- ✅ `/search` route still works for full search.
- ✅ 検索 tab removed from BottomNav (replaced with 献立).

**What was NOT implemented (from the original plan):**
- ❌ Search bar embedded in the home page
- ❌ `QuickRecipes.tsx` component (30-min-or-less recipes section)
- ❌ `SeasonalRecipes.tsx` as a standalone component (seasonal recipes are shown inline in `HomePage`)
- ❌ 4-tab navigation (stayed at 5 tabs: ホーム, 献立, 在庫, お気に入り, 履歴)
- ❌ Dedicated "時短レシピ" section on the home page

**Current CategoryGrid categories (differs from original plan):**

| Category | Filter |
|----------|--------|
| 主菜 🍖 | `主菜` |
| 副菜 🥗 | `副菜` |
| スープ 🍜 | `スープ` |
| ご飯もの 🍙 | `ご飯もの` |
| デザート 🍰 | `デザート` |
| ホットクック 🍲 | `device:hotcook` |
| ヘルシオ 🔥 | `device:healsio` |
| 時短 ⚡ | `quick` |

---

## Phase 11 — Ingredients / Steps Tab Switching ✅ Complete

**What was built (in `src/components/RecipeDetail.tsx`):**
- `useState<'ingredients' | 'steps'>('ingredients')` manages the active tab.
- When `recipe.rawSteps` exists and is non-empty, two tabs are shown: **材料** and **手順**.
- When `rawSteps` is absent (legacy CSV recipes with no step text), only ingredients are shown (no tab UI).
- The ingredients tab shows main ingredients + seasonings in a table, with the missing-ingredient shopping list below.
- The steps tab shows numbered steps with circle indicators.

---

## Phase 12 — Reverse Schedule Prep-Time Calculation ✅ Complete

**What was built:**
- `calculatePrepTime(ingredientCount: number): number` added to `src/utils/recipeUtils.ts`:
  ```
  prepTime = 5 + (ingredientCount - 1) × 2  (minutes)

  Examples:
    3 ingredients → 9 min
    5 ingredients → 13 min
    8 ingredients → 19 min
  ```
- `ScheduleGantt.tsx` updated to use this function.
- Cooking steps structure used by the Gantt chart:
  1. **下ごしらえ** — `calculatePrepTime(ingredients.length)` min
  2. **Device cooking step** — `totalTimeMinutes - prepTime - 3` min (color-coded by device)
  3. **盛り付け** — fixed 3 min
- All step start times are calculated **backward** from `desiredMealHour:desiredMealMinute` (stored in `userPreferences`).

---

## Remaining Work

### Phase 6 — Auto-scheduler
The weekly menu generation schedule (day + time) is configurable in Settings but the actual background trigger is not implemented.
Options:
- Browser push notifications + service worker scheduled task
- Server-side cron job via Supabase Edge Functions

### Phase 10 — Home page completion
If needed:
- Add a search bar to `HomePage.tsx` (navigate to `/search?q=<input>`)
- Add a "時短レシピ" section (filter: `totalTimeMinutes <= 30`)
- Optionally reduce BottomNav to 4 tabs

---

## Architecture Summary

```
src/
├── components/
│   ├── CalendarRegistrationModal.tsx  ← Phase 4
│   ├── CalendarSettings.tsx           ← Phase 5
│   ├── CategoryGrid.tsx               ← Phase 10
│   ├── MealPlanSettings.tsx           ← Phase 5
│   ├── NotificationSettings.tsx       ← Phase 5
│   └── WeeklyMenuTimeline.tsx         ← Phase 8
├── contexts/
│   ├── AuthContext.tsx                ← Phase 2
│   └── PreferencesContext.tsx         ← Phase 5
├── hooks/
│   ├── useAuth.ts                     ← Phase 2
│   ├── usePreferences.ts              ← Phase 5
│   └── useSync.ts                     ← Phase 3
├── lib/
│   ├── supabase.ts                    ← Phase 1
│   ├── googleCalendar.ts              ← Phase 4
│   └── database.types.ts             ← Phase 1
├── pages/
│   └── WeeklyMenuPage.tsx             ← Phase 6
└── utils/
    ├── syncManager.ts                 ← Phase 3
    ├── syncConverters.ts              ← Phase 3
    ├── weeklyMenuSelector.ts          ← Phase 6
    ├── weeklyMenuCalendar.ts          ← Phase 4 + 6
    ├── weeklyShoppingUtils.ts         ← Phase 6
    ├── geminiWeeklyMenu.ts            ← Phase 6
    └── familyCalendarUtils.ts         ← Phase 4 (partial)
```

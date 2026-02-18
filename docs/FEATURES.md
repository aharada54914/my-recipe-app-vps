# Feature Guide

Detailed usage documentation for every feature in Kitchen App.

---

## Table of Contents

1. [Recipe Search](#1-recipe-search)
2. [Recipe Detail](#2-recipe-detail)
3. [Stock Manager](#3-stock-manager)
4. [Weekly Menu](#4-weekly-menu)
5. [Favorites](#5-favorites)
6. [View History](#6-view-history)
7. [AI Recipe Import](#7-ai-recipe-import)
8. [Multi-Schedule View](#8-multi-schedule-view)
9. [Settings](#9-settings)
10. [Home Page](#10-home-page)
11. [PWA & Offline Usage](#11-pwa--offline-usage)

---

## 1. Recipe Search

**Route:** `/search`

### How to search

- Type any keyword in the search bar — matches recipe titles using **fuzzy search** (Fuse.js), so partial and approximate matches work.
- Results update with a 300 ms debounce to avoid excessive DB reads.

### Filters

| Filter | Options |
|--------|---------|
| Device | All / Hotcook / Healsio / Manual |
| Category | All / 主菜 (Main dish) / 副菜 (Side) / スープ (Soup) / ご飯もの (Rice) / デザート (Dessert) |

### Stock match rate badge

Each recipe card shows a **"在庫 XX%"** badge when you have stock data registered.
The percentage is `(matching ingredients ÷ total ingredients) × 100`.
You can sort results by match rate (descending) to see what you can cook right now.

### Healsio Deli detection

Recipes detected as pre-made meal kit instructions (ヘルシオデリ) are automatically sorted to the bottom of results. Detection looks for specific keywords in the title and cooking steps.

### Performance

- Query limit is capped at **200 recipes** per search to prevent memory pressure.
- Virtual scrolling (88 px estimated card height) keeps the list smooth even with many results.

---

## 2. Recipe Detail

**Route:** `/recipe/:id`

### Header

- **Device badge** — Hotcook / Healsio / Manual
- **Star icon** — toggle favorite
- **External link** — opens the original recipe page (CSV recipes only)
- **Calendar icon** — opens the calendar registration modal

### Ingredients tab

- **Serving adjuster** — tap ＋/－ or enter a number directly; all quantities scale proportionally.
- Ingredients are split into two groups:
  - **主材料** (Main ingredients)
  - **調味料・その他** (Seasonings & others)
- Quantities are formatted in human-friendly Japanese style:
  - `1.5 個` → `1個強`
  - `0.45 個` → `約1/2`
  - Values under 1 g are shown as `< 1g`

#### Shopping list (missing ingredients)

Tap the **買い物リスト** button to see which ingredients are **not** in your stock.
A **LINE copy** button formats the list as markdown for easy sharing.

### Steps tab

Shown only when `rawSteps` data is available (AI-imported recipes or Healsio CSV recipes).
Each step is displayed in a numbered list with a circle indicator.

### Salt Calculator

Automatically calculates recommended salt amounts based on the **total weight of ingredients**.

| Mode | Salt % | Example (500 g total) |
|------|--------|-----------------------|
| 薄味 (Light) | 0.6% | 3 g salt / ~19 ml soy sauce / ~25 g miso |
| 標準 (Standard) | 0.8% | 4 g salt / ~25 ml soy sauce / ~33 g miso |
| 濃いめ (Rich) | 1.2% | 6 g salt / ~38 ml soy sauce / ~50 g miso |

Conversion factors: soy sauce ≈ 16% salt, miso ≈ 12% salt.

### Cook Schedule (Gantt Chart)

A horizontal bar chart visualizing each cooking phase:
- **Prep** — estimated from ingredient count (5–20 min)
- **Device step** — Hotcook or Healsio cooking time (color-coded by device)
- **Plating** — fixed 3 min

Start times are calculated **backward** from the target meal time set in Settings → Meal Plan Settings.

### Personal Notes

A free-form textarea below the recipe. Notes are saved to `db.userNotes` and synced to Supabase when online.
Examples: *"塩を少なめにした"*, *"大きく切ると食感が良い"*

### Calendar Registration

Opens a modal to:
1. Select a Google Calendar (fetched live from your account)
2. Set the meal start / end time (defaults from Preferences)
3. Optionally add a reminder (N minutes before)

Requires Google login in Settings.

---

## 3. Stock Manager

**Route:** `/stock`

### Purpose

Track what ingredients you currently have so the app can calculate how many of a recipe's ingredients you already own (match rate).

### How to add / update stock

1. Type an ingredient name in the search box at the top.
2. Synonym expansion runs automatically — searching *"豚肉"* also finds *"豚バラ"*, *"豚ロース"*, etc.
3. Tap an item from search results or from the in-stock list.
4. Enter a quantity — the unit is auto-selected as the most common non-*適量* unit across all recipes using that ingredient.
5. Setting quantity to `0` marks the item as out of stock.

### Display order

- **In-stock items** (quantity > 0) appear at the top, sorted in 50音 (Japanese alphabetical) order.
- **Search results** appear below when a search term is active.

### Data source

The ingredient list is built from all recipes in the database via `ingredientIndex.ts` — only ingredients that appear in at least one recipe can be registered (no custom free-form items).

### Stock query performance note

The `db.stock` table uses `.filter()` (not indexed `.where()`) because the table stays small (~30–100 items). The recipes table always uses indexed `.where()` queries.

---

## 4. Weekly Menu

**Route:** `/weekly-menu`

### Auto-generation

Tap **献立を自動生成** to generate a 7-day meal plan (Sunday through Saturday).

The algorithm scores every eligible recipe on several factors:

| Factor | Weight | Detail |
|--------|--------|--------|
| Stock match rate | 3.0× | Prioritizes recipes you can make with current stock |
| Seasonal bonus | 0.5–3.0× | +10 pts if the recipe contains in-season ingredients (controlled by Seasonal Priority setting) |
| Used last 2 weeks | −20 pts | Prevents repeating recent meals |
| Viewed recently | −5 pts | Gentle nudge toward less-seen recipes |
| Same category × 3+ | −10 pts | Avoids monotonous categories |
| Same device × 4+ | −5 pts | Spreads Hotcook / Healsio / Manual use |
| Device alternation | +3 pts | Bonus for switching device from previous day |

After local scoring, an optional **Gemini refinement** pass can adjust the plan for nutritional balance based on your custom prompt (set in Settings → Meal Plan Settings).

### Locking a day

Tap the **lock icon** on any day's card to keep that recipe when regenerating.
Locked recipes are skipped by the algorithm on subsequent generation.

### Swapping a single recipe

Tap the **swap icon** (↻) on a day card to replace only that day's recipe with an alternative, keeping all other days intact.

### Shopping list

Tap **買い物リスト** to see all ingredients needed for the week, aggregated and de-duplicated:
- Same ingredient name + unit → quantities are summed
- *適量* (to taste) items appear only once
- Sorted: main ingredients first, then out-of-stock items first
- **LINE copy** button formats the list as markdown for easy sharing

### Google Calendar registration

Tap **カレンダー登録** to:
1. Create one meal event per day (with ingredient list in the event description)
2. Create a shopping list event one day before the week starts
3. Optionally add reminders (e.g., 30 min before meal time)

Calendar events are saved to `db.calendarEvents` for tracking and synced to Supabase.

---

## 5. Favorites

**Route:** `/favorites`

- Tap the **star icon** (☆ → ★) on any recipe detail page to add it to favorites.
- Tap again to remove.
- The Favorites page lists all bookmarked recipes sorted by `addedAt` (most recent first).
- Favorites are stored in `db.favorites` and synced to Supabase.

---

## 6. View History

**Route:** `/history`

- Every time you open a recipe detail page, a `viewedAt` timestamp is automatically recorded.
- The History page shows up to **200 most recent** entries.
- Useful for quickly re-finding a recipe you cooked recently.
- History is synced to Supabase (limited to 200 records per sync).

---

## 7. AI Recipe Import

**Route:** `/ai-parse`
**Requires:** Gemini API key

### Workflow

1. Paste a recipe URL into the input field.
2. The app fetches the page and extracts structured data:
   - First tries **JSON-LD / OGP** metadata (fast, no AI needed)
   - Falls back to **Gemini AI parsing** if structured data is missing
3. A **preview** of the parsed recipe is shown — title, ingredients, steps, image.
4. Tap **Save** to write to `db.recipes`.
5. Before saving, the app checks for duplicate titles to avoid double-imports.
6. Saved recipes are flagged for cloud sync (`supabaseId` is set after next sync).

### What gets extracted

| Field | Source |
|-------|--------|
| Title | JSON-LD `name` / page `<h1>` / AI |
| Ingredients | JSON-LD `recipeIngredient` / AI |
| Steps | JSON-LD `recipeInstructions` / AI |
| Image URL | OGP `og:image` / JSON-LD `image` |
| Servings | JSON-LD `recipeYield` / AI |
| Cooking time | JSON-LD `totalTime` / AI |
| Calories | JSON-LD `nutrition` / AI |

---

## 8. Multi-Schedule View

**Route:** `/multi-schedule`

1. Select 2 or more recipes from a list.
2. The app computes all cooking phases for each recipe.
3. Phases are displayed as overlapping Gantt bars, color-coded by device:
   - Orange — Hotcook
   - Teal — Healsio
   - Gray — Manual / prep
4. Useful for planning parallel cooking sessions (e.g., one dish in Hotcook while prepping another).

---

## 9. Settings

**Route:** `/settings`

### Google Login (Account section)

- Tap **Googleでログイン** to authenticate via Google OAuth (Supabase).
- Requested scopes: `calendar.events`, `calendar.readonly`
- After login, the Google OAuth token is available for Calendar API calls.
- Tap **ログアウト** to sign out and return to offline-only mode.

### Cloud Sync

- **今すぐ同期** triggers a full bidirectional sync between local IndexedDB and Supabase.
- Last sync time is shown ("最終同期: X分前").
- Sync errors appear in red below the button.
- See [docs/ARCHITECTURE.md](ARCHITECTURE.md#sync-system) for the detailed sync order and conflict resolution strategy.

### Gemini API Key

| State | UI |
|-------|----|
| Not set | Input field (password-masked) with show/hide toggle |
| Saved | Masked display (`abc123••••••wxyz`) with unlock button |

- Tap **接続テスト** to verify the key with a simple test prompt.
- The key is stored in `localStorage` under `gemini_api_key`.
- If `VITE_GEMINI_API_KEY` is set in `.env`, it always takes priority over the localStorage value.

### Calendar Settings

- Select your default Google Calendar from a dropdown (fetched from your account).
- Set default meal event start and end times (e.g., 19:00–20:00).

### Meal Plan Settings

| Setting | Description |
|---------|-------------|
| Weekly generation schedule | Day of week + time for future auto-generation (not yet automated) |
| Seasonal priority | Low / Medium / High — controls how strongly seasonal ingredients boost recipe scores |
| User prompt | Free text sent to Gemini (e.g., "avoid salty dishes", "include more vegetables") |
| Target meal time | "いただきます" time — used by the cook schedule Gantt chart |

### Notification Settings

| Notification | Description |
|-------------|-------------|
| Weekly menu done | Alert when weekly menu is generated |
| Shopping list ready | Alert when shopping list is prepared |
| Cooking start reminder | Alert N minutes before meal time |

### Data Export / Import

**Export:** Downloads a JSON file with all local data:
- recipes, stock, favorites, userNotes, viewHistory
- Includes metadata (timestamp, app version)

**Import modes:**
| Mode | Behavior |
|------|---------|
| 上書き (Overwrite) | Clears existing data and replaces with imported data |
| マージ (Merge) | Adds new items; updates existing items matched by ID |

---

## 10. Home Page

**Route:** `/`

### Category Grid

Six quick-filter buttons: すべて, 主菜, 副菜, スープ, ご飯もの, デザート.
Tapping a category navigates to the Search page with that filter pre-applied.

### Weekly Menu Timeline (compact)

A condensed 7-day preview of the current weekly menu.
Tap a day to jump to that recipe's detail page.

### Stock-based Recommendations

Recipes ranked by stock match rate, displayed in a horizontal scroll row.
Generated by `geminiRecommender.ts` using local scoring (no API call required for the basic version).

### Seasonal Picks (旬のおすすめ)

Recipes highlighted because they contain ingredients that are in season during the current month.
Seasonal data is defined in `src/data/seasonalIngredients.ts`.

---

## 11. PWA & Offline Usage

### Installing on iOS (Safari only)

1. Open the app URL in **Safari** (not Chrome — iOS Chrome cannot install PWAs).
2. Tap the Share button → **ホーム画面に追加** (Add to Home Screen).
3. The app launches in standalone mode (no browser UI) with theme color `#121214`.

### Installing on Android (Chrome)

1. Open the app URL in Chrome.
2. Tap the **"Install app"** banner or use the three-dot menu → **Install**.

### Offline capabilities

All of the following work completely offline:

- Browse and search all ~1,700 recipes
- View recipe detail, ingredients, and steps
- Use the salt calculator and cook schedule
- Manage stock
- Read favorites and history
- View (but not generate) weekly menus
- Read and write personal notes

The following require internet:

- Cloud sync (Supabase)
- Google Calendar registration
- AI recipe import and weekly menu refinement (Gemini API)
- Google login

### Screen always-on (Wake Lock)

On supported browsers, the screen stays on while viewing a recipe.
On iOS (which does not support the Wake Lock API), `NoSleep.js` is used as a fallback.

### iOS-specific notes

| Issue | Solution applied |
|-------|-----------------|
| `100vh` includes the address bar | JS sets `--vh` CSS variable dynamically |
| Auto-zoom on input focus | All inputs use `font-size: 16px` minimum |
| Dynamic Island overlap | `env(safe-area-inset-top)` in CSS |
| Bottom nav overlap | `env(safe-area-inset-bottom)` in CSS |
| User zoom disrupts layout | `maximum-scale=1` in viewport meta |

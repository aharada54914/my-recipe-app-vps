# Kitchen App — Smart Recipe Manager PWA

A Progressive Web App for Japanese home cooking with smart kitchen appliances (Hotcook / Healsio).
Offline-first design with AI-powered weekly meal planning, ingredient stock management, and Google Calendar integration.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Page Structure](#page-structure)
- [Documentation](#documentation)
- [Tech Stack](#tech-stack)

---

## Features

| Feature | Description |
|---------|-------------|
| Recipe Search | Full-text fuzzy search across ~1,700 recipes (Hotcook + Healsio) — works offline |
| Stock Management | Register fridge ingredients and see each recipe's stock match rate |
| AI Weekly Menu | Auto-generate a 7-day meal plan using Gemini API with diversity scoring |
| Google Calendar | Register meals as calendar events, add a shopping list reminder |
| Cloud Backup | Backup/restore user data via Google Drive AppData |
| PWA | Install to home screen and use as a native app |
| Favorites & History | Bookmark recipes and track recently viewed |
| Personal Notes | Save cooking tips per recipe (e.g., "added less salt") |
| Salt Calculator | Auto-calculate salt / soy sauce / miso amounts from total ingredient weight |
| Cook Schedule | Gantt chart of cooking steps, calculated backward from target meal time |
| AI Recipe Import | Paste any recipe URL — Gemini extracts ingredients and steps automatically |
| Multi-Schedule | View overlapping Gantt timelines for multiple simultaneous recipes |

---

## Quick Start

Node.js `22.12.0+` is recommended (see `.nvmrc`).

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Production build (CSV → JSON pre-build → tsc type-check → Vite bundle)
npm run build

# Preview production build locally
npm run preview

# Lint
npm run lint

# Unit tests
npm run test
```

### What happens on first launch

1. Dexie.js initializes the IndexedDB database (`RecipeDB`, version 8)
2. If the recipes table is empty, ~1,700 recipes are bulk-inserted from pre-built JSON files
3. All features are immediately available — no internet required

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values.

```bash
cp .env.example .env
```

```env
# Supabase — optional. All offline features work without this.
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google OAuth — optional, required for Google login + Drive backup + Calendar integration.
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id

# Gemini API — optional. Can also be entered in the Settings page.
VITE_GEMINI_API_KEY=your-gemini-api-key
```

> **Note:** The `.env` value takes priority over the key saved in the Settings page (localStorage).
> The Gemini API key stored in localStorage is acceptable for personal use but should not be used in shared environments.
> If `VITE_GOOGLE_CLIENT_ID` is not set, OAuth-based features are safely disabled.
> For Vercel deployments, `vercel.json` includes SPA rewrites so deep routes resolve to `index.html`.

---

## Page Structure

```
/               Home
                  Category grid, weekly menu preview
                  Stock-based recommendations, seasonal picks

/search         Recipe Search
                  Fuzzy text search, device filter (Hotcook / Healsio / Manual)
                  Category filter, stock match rate badge, sort by match rate

/stock          Stock Manager
                  Register ingredients with quantities
                  Auto-sorted alphabetically (50音順), synonym-aware search

/favorites      Favorites
                  Recipes bookmarked with the star icon

/history        View History
                  Recently viewed recipes (up to 200)

/weekly-menu    Weekly Menu
                  AI-generated 7-day plan, lock individual days
                  Aggregated shopping list, Google Calendar registration

/recipe/:id     Recipe Detail
                  Ingredients (scaling adjuster), cooking steps
                  Salt calculator, cook schedule Gantt, personal notes
                  Favorite toggle, missing-ingredient shopping list, calendar

/ai-parse       AI Recipe Import
                  Paste a URL → Gemini extracts recipe data → preview → save

/multi-schedule Multi-Schedule View
                  Select multiple recipes → view overlapping Gantt timelines

/settings       Settings
                  Google login, Gemini API key, sync, data export / import
                  Calendar settings, meal plan settings, notification settings
```

---

## Documentation

| File | Description |
|------|-------------|
| [docs/FEATURES.md](docs/FEATURES.md) | Detailed usage guide for every feature |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | DB schema, API specs, sync system, component map |
| [docs/SETUP.md](docs/SETUP.md) | Full setup, Supabase config, deployment, PWA install |

---

## Tech Stack

| Category | Library / Tool |
|----------|---------------|
| Framework | React 19 + TypeScript (strict) + Vite 7 |
| Styling | Tailwind CSS 4 |
| Routing | React Router 7 |
| Local DB | Dexie.js 4.3 (IndexedDB) + dexie-react-hooks |
| Cloud | Google OAuth + Google Drive AppData backup (Supabase optional) |
| AI | Google Gemini API (`gemini-2.0-flash`) |
| Search | Fuse.js 7.1 (fuzzy search) |
| Virtual Scroll | @tanstack/react-virtual 3.13 |
| Icons | Lucide React |
| Date Utils | date-fns 4.1 (ja locale) |
| PWA | vite-plugin-pwa + Workbox |
| Wake Lock | NoSleep.js (iOS fallback) |
| Testing | Vitest 4.0 + JSDOM |

### Design System

| Token | Value |
|-------|-------|
| Background | `#121214` (near-black dark) |
| Card background | `#1a1a1c` (slightly lighter) |
| Accent | `#F97316` (orange) |
| Border radius | `rounded-xl` (12px) / `rounded-2xl` (16px) |
| Font | `-apple-system, system-ui, sans-serif` |
| Input min font-size | 16px (prevents iOS auto-zoom) |

# Setup & Deployment Guide

Step-by-step instructions for local development, Supabase configuration, and deployment.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development](#2-local-development)
3. [Supabase Setup](#3-supabase-setup)
4. [Google OAuth & Calendar Setup](#4-google-oauth--calendar-setup)
5. [Gemini API Setup](#5-gemini-api-setup)
6. [Production Build & Deployment](#6-production-build--deployment)
7. [PWA Installation](#7-pwa-installation)
8. [Updating Recipe Data](#8-updating-recipe-data)

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 20+ | LTS recommended |
| npm | 10+ | Comes with Node.js |
| Git | any | |

Optional (for cloud features):
- A [Supabase](https://supabase.com) project
- A [Google Cloud](https://console.cloud.google.com) project with Calendar API enabled
- A [Google AI Studio](https://aistudio.google.com) Gemini API key

---

## 2. Local Development

```bash
# Clone the repository
git clone https://github.com/aharada54914/my-recipe-app.git
cd my-recipe-app

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# → Edit .env with your values (all optional for offline-only use)

# Start the dev server
npm run dev
# → Opens at http://localhost:5173
```

On first load, the app auto-inserts ~1,700 recipes into IndexedDB.
This takes a second or two — subsequent loads are instant.

### Available npm scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Run prebuild → tsc type-check → Vite production bundle |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run ESLint (TypeScript + React Hooks rules) |
| `npm run test` | Run Vitest unit tests |
| `npm run test:watch` | Run Vitest in watch mode |

### Build pipeline detail

`npm run build` executes three steps in order:

```
1. scripts/prebuild-recipes.mjs
   Reads CSV files → parses ingredients/steps → outputs:
     src/data/recipes-hotcook.json
     src/data/recipes-healsio.json

2. tsc -b
   TypeScript strict-mode type check (no emit)

3. vite build
   Bundles app → dist/
   Generates Service Worker via vite-plugin-pwa
```

---

## 3. Supabase Setup

> Skip this section if you only need offline functionality.

### 3.1 Create a project

1. Go to [app.supabase.com](https://app.supabase.com) and create a new project.
2. Note your **Project URL** and **anon public key** from Project Settings → API.

### 3.2 Run migrations

In the Supabase SQL Editor, run the migration files in order:

```sql
-- Run first:
-- supabase/migrations/001_initial_schema.sql

-- Run second:
-- supabase/migrations/002_rls_policies.sql
```

This creates all 8 tables with proper RLS policies (each user can only access their own data).

### 3.3 Configure environment

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3.4 Verify

Start the app, go to Settings, and tap **Googleでログイン**.
After authentication, the sync button should become active.

---

## 4. Google OAuth & Calendar Setup

> Required for Google login and calendar registration features.

### 4.1 Create a Google Cloud project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the **Google Calendar API**:
   - APIs & Services → Library → search "Google Calendar API" → Enable

### 4.2 Configure OAuth consent screen

1. APIs & Services → OAuth consent screen
2. Select **External** user type
3. Fill in app name, support email, developer email
4. Add scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
5. Add test users (your Google accounts for testing)

### 4.3 Create OAuth credentials

1. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
2. Application type: **Web application**
3. Authorized redirect URIs — add your Supabase callback URL:
   ```
   https://your-project-id.supabase.co/auth/v1/callback
   ```

### 4.4 Configure Supabase Google provider

1. Supabase Dashboard → Authentication → Providers → Google
2. Enable Google
3. Paste the **Client ID** and **Client Secret** from step 4.3
4. Save

### 4.5 Verify

In the app, go to Settings → tap **Googleでログイン**.
After OAuth consent, you should see your email displayed and the calendar dropdown should populate.

---

## 5. Gemini API Setup

> Required for AI recipe import and weekly menu refinement.

### 5.1 Get an API key

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click **Get API key** → Create API key
3. Copy the key

### 5.2 Configure

**Option A — via `.env` (recommended for development):**

```env
VITE_GEMINI_API_KEY=your-gemini-api-key
```

**Option B — via the Settings page (no rebuild needed):**

1. Open the app → Settings
2. Find the **Gemini API Key** section
3. Paste your key and tap Save
4. Tap **接続テスト** to verify

> The `.env` value always takes priority over the Settings page value.

### 5.3 Model used

The app uses `gemini-2.0-flash` for all AI operations.
Typical usage:
- AI recipe import: 1 request per URL
- Weekly menu refinement: 1 request per generation (optional step)

---

## 6. Production Build & Deployment

### Build

```bash
npm run build
# Output goes to dist/
```

### Deploy to Vercel

```bash
npm install -g vercel
vercel
# Follow prompts — set environment variables in the Vercel dashboard
```

Or connect your GitHub repo in the Vercel dashboard for automatic deploys on push.

**Environment variables to set in Vercel:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY` (optional)

### Deploy to Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

Or drag the `dist/` folder into the Netlify dashboard.

### Deploy to any static host

The `dist/` folder is a fully self-contained static site.
Upload it to any web server, S3 bucket, GitHub Pages, Cloudflare Pages, etc.

**Important:** Configure the server to return `index.html` for all routes (client-side routing):

**Nginx example:**
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

**Apache example (`.htaccess`):**
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ /index.html [L]
```

### HTTPS requirement

The following features **require HTTPS** (browser security restrictions):
- Service Worker (PWA offline caching)
- Screen Wake Lock API
- Google OAuth redirect

Local `http://localhost:5173` is exempt and works fine for development.

---

## 7. PWA Installation

### iOS (iPhone / iPad)

1. Open the deployed app URL in **Safari** (not Chrome or Firefox)
2. Tap the **Share** button (box with up arrow)
3. Scroll down and tap **ホーム画面に追加** (Add to Home Screen)
4. Edit the name if desired → tap **追加**

The app now opens full-screen without browser UI, using theme color `#121214`.

> **Note:** iOS Chrome and Firefox cannot install PWAs — only Safari supports this on iOS.

### Android

1. Open the deployed app URL in **Chrome**
2. An **"Install app"** banner should appear at the bottom automatically
3. If not, tap the three-dot menu → **Install app** (or **Add to Home Screen**)

### Checking PWA status

Open DevTools → Application → Service Workers to verify the Service Worker is registered and the manifest is detected.

---

## 8. Updating Recipe Data

Recipe data lives in two CSV files at the project root:

| File | Device | Recipes |
|------|--------|---------|
| `KN-HW24H_recipes_complete_complete.csv` | Hotcook (KN-HW24H) | ~350 |
| `AX-XA20_recipes_complete.csv` | Healsio (AX-XA20) | ~1,372 |

### Regenerate JSON from CSV

```bash
node scripts/prebuild-recipes.mjs
# Outputs: src/data/recipes-hotcook.json
#          src/data/recipes-healsio.json
```

This runs automatically as part of `npm run build`.

### Deploying updated data

1. Update or replace the CSV file(s)
2. Run `npm run build`
3. Deploy the new `dist/` folder

Existing users will receive the updated recipes on their next sync.
If they already have recipes in IndexedDB, `initDb()` will **not** overwrite them (it only runs when the table is empty).

To force a data refresh for existing users, you would need to implement a schema version bump in Dexie (increment the version number in `db.ts`) with a migration that clears and re-inserts the pre-built data.

# Setup & Deployment Guide

Step-by-step instructions for local development, Google OAuth setup, and deployment.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development](#2-local-development)
3. [Google OAuth & Google APIs Setup](#3-google-oauth--google-apis-setup)
4. [Gemini API Setup](#4-gemini-api-setup)
5. [Production Build & Deployment](#5-production-build--deployment)
6. [PWA Installation](#6-pwa-installation)
7. [Updating Recipe Data](#7-updating-recipe-data)

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 22.12+ | Recommended (matches `.nvmrc` and CI) |
| npm | 10+ | Comes with Node.js |
| Git | any | |

Optional:
- A [Google Cloud](https://console.cloud.google.com) project (OAuth + Calendar + Drive)
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

# Start dev server
npm run dev
# -> http://localhost:5173
```

On first load, the app auto-inserts recipe data into IndexedDB.

### Available npm scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Run prebuild -> tsc -> Vite production bundle |
| `npm run preview` | Serve production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest unit tests |

---

## 3. Google OAuth & Google APIs Setup

Required for:
- Google login
- Google Drive backup/restore
- Google Calendar registration

### 3.1 Create Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com)
2. Create a project
3. Enable APIs:
   - Google Calendar API
   - Google Drive API

### 3.2 OAuth consent screen

1. APIs & Services -> OAuth consent screen
2. User type: External
3. Fill app name/support email/developer email
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/drive.appdata`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
5. Add test users for development

### 3.3 Create OAuth client

1. APIs & Services -> Credentials -> Create OAuth client ID
2. Application type: Web application
3. Add Authorized JavaScript origins:
   - `http://localhost:5173`
   - your production domain (for example `https://your-app.vercel.app`)

### 3.4 Configure app env

```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

If this variable is missing, the app boots normally and OAuth features stay disabled.

---

## 4. Gemini API Setup

Required for AI recipe import and optional weekly menu refinement.

1. Create an API key in [Google AI Studio](https://aistudio.google.com)
2. Set either:

```env
VITE_GEMINI_API_KEY=your-gemini-api-key
```

or save it in Settings inside the app.

The `.env` value has priority over the Settings-stored key.

---

## 5. Production Build & Deployment

### Build

```bash
npm run build
# output: dist/
```

### Deploy to Vercel

This repository includes `vercel.json` with SPA rewrites.
Deep links such as `/settings` and `/recipe/1` resolve to `index.html`.

Set environment variables in Vercel:
- `VITE_GOOGLE_CLIENT_ID` (optional, required for OAuth features)
- `VITE_GEMINI_API_KEY` (optional)

### Deploy to any static host

Upload `dist/` and configure SPA fallback to `/index.html`.

---

## 6. PWA Installation

### iOS (Safari only)

1. Open deployed URL in Safari
2. Share -> Add to Home Screen
3. Tap Add

### Android (Chrome)

1. Open deployed URL in Chrome
2. Tap Install app (or menu -> Add to Home Screen)

---

## 7. Updating Recipe Data

Recipe source CSV files:
- `KN-HW24H_recipes_complete_complete.csv`
- `AX-XA20_recipes_complete.csv`

Regenerate JSON:

```bash
node scripts/prebuild-recipes.mjs
```

This runs automatically during `npm run build`.

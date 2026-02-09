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
- **Tailwind CSS** (to be integrated) for styling
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

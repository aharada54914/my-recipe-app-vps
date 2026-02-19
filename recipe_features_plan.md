# my-recipe-app 機能一覧

## 1. はじめに

このドキュメントは、現在の`my-recipe-app`に実装されている機能の一覧と、その実装状況をまとめたものです。

## 2. 機能一覧

| カテゴリ | 機能名 | 実装状況 | 関連コンポーネント/技術 |
| :--- | :--- | :--- | :--- |
| **レシピ閲覧** | レシピ一覧表示 | ✅ 実装済み | `RecipeList.tsx`, `@tanstack/react-virtual` |
| | レシピ詳細表示 | ✅ 実装済み | `RecipeDetailPage.tsx` |
| | お気に入り登録 | ✅ 実装済み | `useFavorites.ts`, `db.ts` |
| **レシピ検索** | あいまい検索 | ✅ 実装済み | `Fuse.js`, `SearchBar.tsx` |
| | カテゴリ絞り込み | ✅ 実装済み | `RecipeList.tsx` |
| **在庫管理** | 在庫一覧・追加・削除 | ✅ 実装済み | `StockManager.tsx`, `dexie-react-hooks` |
| | 在庫率に基づくレシピ推薦 | ✅ 実装済み | `useStock.ts`, `recipeUtils.ts` |
| **調理サポート** | 塩分量計算 | ✅ 実装済み | `SaltCalculator.tsx` |
| | 複数レシピの調理スケジュール | ✅ 実装済み | `MultiScheduleView.tsx`, ガントチャート表示 |
| | 買い物リスト生成 | ✅ 実装済み | `ShoppingListPage.tsx` |
| | 画面スリープ防止 | ✅ 実装済み | `useWakeLock.ts` |
| **AI連携** | テキストからのレシピ解析 | ✅ 実装済み | `AiRecipeParser.tsx`, `geminiParser.ts` |
| **PWA対応** | オフライン動作 | ✅ 実装済み | `vite-plugin-pwa`, Service Worker |
| | ホーム画面に追加 | ✅ 実装済み | `manifest.webmanifest` |
| **設定** | Gemini APIキー設定 | ✅ 実装済み | `SettingsPage.tsx` |
| **データ管理** | レシピデータの初期投入 | ✅ 実装済み | `initDb.ts`, プリビルドJSON |
| | CSVインポート（旧機能） | ⛔️ 廃止済み | `ImportPage.tsx`は削除済み |

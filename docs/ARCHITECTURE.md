# Architecture Reference

最終改訂: 2026-03-07  
対象バージョン: v2.0.0

Kitchen App の現行アーキテクチャ概要です。Phase 5 / 6 の UI 再編、theme foundation、テスト再構成を反映しています。

---

## 1. 技術スタック

- フロントエンド: React 19 + TypeScript + Vite 7
- ルーティング: React Router 7
- ローカル DB: Dexie / IndexedDB
- 状態管理:
  - Context: 認証、設定
  - Zustand: UI 通知などの横断 UI 状態
- 外部連携:
  - Google OAuth
  - Google Drive API
  - Google Calendar API
  - Gemini API
- テスト:
  - Vitest
  - Playwright

---

## 2. ディレクトリ構成

- `src/pages`
  - 画面単位のルートコンポーネント
- `src/components`
  - 再利用 UI
  - `settings/`, `gemini/`, `weekly/` など用途別に分割
- `src/hooks`
  - 画面 / ユースケース単位の制御ロジック
  - 例: `useWeeklyMenuController.ts`
- `src/repositories`
  - IndexedDB への永続化責務を集約
  - `preferencesRepository.ts`
  - `stockRepository.ts`
  - `weeklyMenuRepository.ts`
- `src/services`
  - 起動時や複数レイヤをまたぐアプリケーションサービス
  - `preferencesStartup.ts`
- `src/db`
  - Dexie スキーマとマイグレーション
- `src/lib`
  - 外部 API / theme / QA モードなどの境界レイヤ
- `src/utils`
  - 純ロジックとアルゴリズム
- `tests/smoke`
  - ルート / フロー単位の Playwright smoke
- `tests/visual`
  - Playwright visual regression
- `tests/support`
  - Playwright 共通 helper
- `scripts`
  - build 前処理、監査、運用スクリプト

---

## 3. UI 基盤

### 3.1 Theme Foundation

- semantic token は `src/index.css` に集約
- `src/lib/theme.ts` が `system / light / dark` を解決
- `PreferencesContext` が `appearanceMode` と `resolvedTheme` を配布
- 初回ロード時は `index.html` の bootstrap で FOUC を抑制

### 3.2 App Chrome

- `Header.tsx`
  - sticky header
  - `検索`, `複数レシピスケジュール`, `在庫管理`, `設定 / 接続` への導線
- `BottomNav.tsx`
  - ラベル付き 5 タブ
  - `ホーム / 献立 / Gemini / お気に入り / 履歴`
  - safe-area を考慮した固定ナビ

### 3.3 共通 UI パターン

- `StatusNotice.tsx`
  - Google / Gemini / Calendar などの接続状態表示を統一
- `ui-*` class
  - button, panel, action card, stat card などの semantic utility を利用
- glass 系 class は app shell の必須前提から外している

---

## 4. データ層

### 4.1 DB

- `RecipeDB` は Dexie schema version `18`
- 主なテーブル:
  - `recipes`
  - `stock`
  - `favorites`
  - `userNotes`
  - `viewHistory`
  - `calendarEvents`
  - `userPreferences`
  - `weeklyMenus`

### 4.2 Repository 境界

- UI は直接 Dexie 更新を持たず、主要ユースケースから repository を経由する方針へ移行済み
- 特に以下は repository 経由を優先
  - 設定更新
  - 在庫数量更新
  - 週間献立保存

### 4.3 Preferences / Theme

- `appearanceMode` は `userPreferences` と localStorage の両方で管理
- 起動時に `preferencesStartup.ts` が初期値補正を行う

---

## 5. 主要フロー

### 5.1 ホーム

- `HomePage.tsx` は `検索` と `AI 相談` を一次導線に置く
- 二次導線として `今週の献立` サマリーを表示
- 天気取得は `weatherProvider` を通じて実行
- Gemini の接続状態は `getGeminiIntegrationStatus()` で要約表示

### 5.2 週間献立

- `WeeklyMenuPage.tsx` は表示責務を中心に保持
- 生成 / 永続化 / 共有 / カレンダー登録まわりの制御は `useWeeklyMenuController.ts` へ分離
- 画面構成:
  - summary
  - featured day
  - rest of week
  - shopping list / modal

### 5.3 Google / Gemini 連携

- `AuthContext`
  - OAuth user / token の保持
  - QA Google mode との切替
- `googleDrive.ts`
  - backup / restore
  - QA 時は localStorage ベースのモックへ切替
- `googleCalendar.ts`
  - calendar 一覧取得
  - 献立 / 買い物イベント登録
  - QA 時はモックイベント保存へ切替
- `integrationStatus.ts`
  - Gemini / Google / Calendar の状態を `actionId` と tone で統一管理

---

## 6. QA モード

- `?qa-google=1` で connected flow を実アカウントなしに再現
- モック対象:
  - Google ログイン済み user
  - Drive バックアップ / 復元
  - Calendar 予定登録
- 入口:
  - `設定 > 詳細設定 > 接続フロー検証`
  - 旧 URL の `/settings/data?qa-google=1` でも詳細設定へリダイレクト
- 主用途:
  - smoke test
  - visual regression
  - 手動 UI 監査

---

## 7. テスト戦略

### 7.1 Unit / Component

- 実行: `npm test`
- 目的:
  - 純ロジック
  - settings / theme / status などの UI コンポーネント

### 7.2 Smoke

- 実行: `npm run test:smoke:ci`
- 構成:
  - `navigation.spec.ts`
  - `home-priority.spec.ts`
  - `gemini-entry.spec.ts`
  - `weekly-menu-core.spec.ts`
  - `weekly-menu-editing.spec.ts`
  - `connected-google.spec.ts`
  - `connected-gemini.spec.ts`

### 7.3 Visual Regression

- 実行: `npm run test:visual`
- snapshot 更新: `npm run test:visual:update`
- 対象:
  - home
  - search
  - gemini
  - weekly menu
  - settings connected states

### 7.4 UI Class Audit

- 実行: `npm run ui:class-audit`
- `scripts/ui-class-audit.mjs` が glass 系 class の残存数を監査

---

## 8. Build / Deploy

- `npm run build`
  - `scripts/prebuild-recipes.mjs`
  - `tsc -b`
  - `vite build`
- PWA: `vite-plugin-pwa`
- 配布: Vercel
- `vercel.json` で SPA rewrite を処理

---

## 9. 補足

- 古い実装計画書やレビュー記録は `docs/plans/` と `docs/reports/` に残している
- 現行の正は本書、[FEATURES.md](/Users/jrmag/my-recipe-app/docs/FEATURES.md)、[SETUP.md](/Users/jrmag/my-recipe-app/docs/SETUP.md)、[TESTING.md](/Users/jrmag/my-recipe-app/docs/TESTING.md)

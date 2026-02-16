# PM分析レポート & リファクタリング計画

## 1. 現状分析

### 1-1. プッシュ履歴サマリ（直近コミット）

| コミット | 内容 |
|----------|------|
| `af1fd8b` (HEAD) | v2 Refactoring — プリビルドパイプライン, ブランディング(Kitchen App), PNGアイコン, エージェント定義更新, ImportPage削除 |
| `deb3f51` | Phase 4 — CSV Import, Gantt, Stock, Settings, Salt Fix |
| `76a17b0` | Phase 3b — RecipeImage, iOS 100vh, PWA, Concurrent, Worker |
| `fc6f453` | fix: RecipeDetail hooks order |
| `7517d63` | Phase 3a — userNotes, 買い物リスト, 5タブ化 |
| `84b70a9` | Phase 1+2 — Fuse.js, 仮想スクロール, Router, DB最適化, favorites, Wake Lock |

### 1-2. 未コミットの作業（ワーキングツリー）

`git status` で以下の**未コミット修正**が検出された：

- **テスト追加**: `src/utils/__tests__/recipeUtils.test.ts`, `csvParser.test.ts`, `geminiParser.test.ts` ← NEW
- **PWA対応**: `vite.config.ts` に `vite-plugin-pwa` 設定追加、`public/manifest.json` 削除（プラグイン管理に移行）
- **アイコン**: `public/icon.svg` 追加
- **コード修正**: `App.tsx`, `RecipeList.tsx`, `RecipeCard.tsx`, `BottomNav.tsx`, `Header.tsx`, `useWakeLock.ts`, `csvParser.ts`, `geminiParser.ts`, `recipeUtils.ts` 等
- **Worker削除**: `src/workers/search.worker.ts` 削除

### 1-3. レビュー文書（統合済み — 元ファイルは削除）

以下のレビュー文書の知見はすべて本 PLAN.md に統合済み：
1. **REVIEW.md**（削除済み）— Service Worker欠如、アイコン、initDb冗長性、ルーティング問題等を指摘 → Gap分析 2-2 に包含
2. **PM_REVIEW.md**（削除済み）— ドキュメント矛盾点6件 + リファクタリング計画8件 → 固有知見を Phase B/C に統合、v2対応済み項目は現状分析に反映
3. **QA_REPORT.md**（`claude/qa-review-evaluation-5R0XQ` ブランチ、別管理）— 18件の指摘（Critical 1, High 2, Medium 11, Low 4）→ Gap分析 2-1 に包含

---

## 2. 整合性チェック（Gap分析）

### 凡例
- ✅ **解消済み** = 未コミット修正で対応済み
- ⚠️ **部分対応** = 修正が不十分、または新たな矛盾が発生
- ❌ **未対応** = まだ対応されていない

### 2-0. v2 リファクタリング (af1fd8b) で解消済みの項目

v2 コミットにより、PM_REVIEW.md で提案された以下の課題が対応済み：

| PM_REVIEW提案 | 対応内容 | 関連ファイル |
|--------------|---------|-------------|
| データ戦略の変更（CSVインポート廃止→ビルド時バンドル） | `scripts/prebuild-recipes.mjs` でCSV→JSON変換、`src/data/recipes-*.json` バンドル、`ImportPage.tsx` 削除、初回起動時DB自動投入 | `scripts/prebuild-recipes.mjs`, `src/data/recipes-*.json`, `src/db/initDb.ts` |
| ブランディング（アプリ名・アイコン統一） | アプリ名「Kitchen App」統一、`ForkKnifeIcon.tsx` 実装、192/512 PNGアイコン追加 | `src/components/ForkKnifeIcon.tsx`, `public/app-icon-*.png`, `index.html` |
| エージェント定義の更新 | `agents/LOGIC.md`, `agents/QA.md`, `agents/UI.md` の記述をv2に整合 | `agents/*.md` |

---

### 2-1. QA_REPORT指摘 vs 現在の実装

| # | QA指摘 | 重要度 | 状態 | 詳細 |
|---|--------|--------|------|------|
| 1 | テスト完全不在 | 🔴Critical | ✅解消済み | `recipeUtils.test.ts`, `csvParser.test.ts`, `geminiParser.test.ts` が追加済み |
| 2 | `stockNames` メモ化漏れ (RecipeList.tsx:42) | 🔴High | ✅解消済み | `useMemo`でラップ済み（line 44） |
| 3 | MultiScheduleView 全件ロード | 🔴High | ✅解消済み | `.limit(200)` で制限済み（line 29） |
| 4 | APIキー localStorage保存 | 🟡Medium | ❌未対応 | 個人PWAとして許容範囲だが、CLAUDE.md に注意事項の記載なし |
| 5 | JSON.parse 無検証 | 🟡Medium | ✅解消済み | `validateParsedRecipe` で各フィールドの型検証実装済み |
| 6 | CSV全件ロード (`toArray()`) | 🟡Medium | ✅解消済み | `orderBy('title').uniqueKeys()` に変更済み |
| 7 | Worker未使用 | 🟡Medium | ⚠️方針変更 | Worker自体を削除。メインスレッド実行に統一。CLAUDE.mdの記述と矛盾 |
| 8 | aria-label欠如 | 🟡Medium | ⚠️部分対応 | Header.tsx、BottomNav.tsx にaria-label追加済み。他コンポーネントは未確認 |
| 9 | BottomNav safe-area | 🟡Medium | ✅解消済み | `style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}` 追加済み |
| 10 | homeとsearchが同URL | 🟡Medium | ❌未対応 | `activeTab` state での切替のまま、URL分離未実施 |
| 11 | バンドルサイズ | 🟡Medium | ⚠️部分対応 | `@google/generative-ai` の dynamic import 化は `geminiParser.ts` で実施済み。チャンク分割の効果は要検証 |
| 12 | Wake Lock リーク | 🟡Medium | ✅解消済み | `useEffect` 内のクリーンアップが `wakeLockRef`/`noSleepRef` の両方を適切に処理 |
| 13 | Service Worker未実装 | 🟡Medium | ✅解消済み | `vite-plugin-pwa` with workbox 設定追加済み |
| 14 | manifest.json アイコン不足 | 🟡Medium | ✅解消済み | v2 (af1fd8b) で 192x192/512x512 PNGアイコン追加済み |
| 15 | initDb エラーハンドリング | 🟡Medium | ✅解消済み | `.catch(() => setError(DB_ERROR_MSG))` 追加済み |
| 16 | 到達不能コード | 🟢Low | ❌未対応 | `formatQuantityVibe` の `value === 0 && unit === '適量'` 分岐 |
| 17 | FavoritesPage 仮想スクロール無し | 🟢Low | ❌未対応 | お気に入りが少数のため優先度低 |
| 18 | initDb 重複呼出 | 🟢Low | ❌未対応 | 各ページラッパーが独自に initDb を呼ぶ構造のまま |

### 2-2. REVIEW.md 指摘 vs 現在の実装

| # | REVIEW指摘 | 状態 | 詳細 |
|---|------------|------|------|
| 1 | Service Worker 完全欠落 | ✅解消済み | vite-plugin-pwa 導入済み |
| 2 | アプリアイコンがデフォルト | ✅解消済み | icon.svg + 192/512 PNGアイコン + ForkKnifeIcon.tsx 追加済み (v2) |
| 3 | initDb 冗長呼出 | ❌未対応 | ページラッパーごとの initDb が残存 |
| 4 | 塩分丸め処理の不一致 | ⚠️要確認 | CLAUDE.md「10g単位丸め → 重量表示」vs「塩分計算 → 小数1桁」の記述が曖昧 |
| 5 | react-router-dom の非効率利用 | ❌未対応 | activeTab state + navigate の二重管理が残存 |

---

### 2-3. CLAUDE.md の記述 vs 実装の矛盾

#### 🔴 矛盾① — Web Worker の記述と実装の乖離

**CLAUDE.md の記述** (lines 167-168):
> 🚀 Offload heavy computations to Web Workers
> Use `new Worker(new URL('../workers/matchRate.worker.ts', import.meta.url))`

**実装**: `src/workers/search.worker.ts` がワーキングツリーで**削除済み**。検索は `searchUtils.ts` でメインスレッド実行。

**矛盾の詳細**: CLAUDE.md は Web Worker をパフォーマンス最適化の中核技術として定義しているが、実装からは完全に除外されている。2000件規模のデータセットでは、メインスレッドでの Fuse.js 検索がUI応答性に影響する可能性がある。

**対応方針**: Worker削除の判断が意図的なら、CLAUDE.md から Web Worker の記述を削除または「将来実装」に格下げすべき。

---

#### 🟡 矛盾② — 仮想スクロールライブラリの不一致

**CLAUDE.md の記述** (line 143):
> Library: `@tanstack/react-virtual`

**agents/UI.md の記述** (line 22):
> `react-virtuoso` 等を使用し、大量リストでもヌルヌル動く描画を心がける

**agents/QA.md の記述** (line 9):
> `react-virtuoso` 等の仮想化チェック

**実装**: `@tanstack/react-virtual` を使用（`RecipeList.tsx`）。

**矛盾の詳細**: `CLAUDE.md` は `@tanstack/react-virtual` を指定しており、実装もそれに従っている。しかし、`agents/QA.md` と `agents/UI.md` は `react-virtuoso` を参照している。エージェント定義ファイルが CLAUDE.md と矛盾。

---

#### 🟡 矛盾③ — 全レシピ一括ロード禁止ルール vs 「すべて」カテゴリ

**CLAUDE.md の記述** (lines 59-63):
> 🔴 NEVER load all recipes at once
> `db.recipes.toArray()` loads entire dataset into memory

**実装** (`RecipeList.tsx:35`):
```typescript
db.recipes.limit(PAGE_SIZE).toArray() // PAGE_SIZE = 200
```

**状況**: `limit(200)` でクエリ制限されているが、200件は CLAUDE.md が示す `PAGE_SIZE = 50` より4倍大きい。また、ソート条件がないため、どの200件が返されるか不定。

---

#### 🟡 矛盾④ — テスト戦略の記述 vs 実装

**CLAUDE.md の記述** (lines 406-410):
> Framework: Vitest + @testing-library/react + jsdom
> `npm test` (single run), `npm run test:watch` (watch mode)

**実装**: Vitest が `devDependencies` に追加済み、テストファイル3つ存在。しかし `@testing-library/react` によるコンポーネントテストは未実装。`searchUtils.ts` のテストも未実装（CLAUDE.md のカバレッジ表で明記されているにもかかわらず）。

---

#### 🟡 矛盾⑤ — CLAUDE.md 内の重複セクション

CLAUDE.md 内に以下の内容が重複して記載されている：
- **Image Handling Strategy** が2回出現（lines 180-237 と lines 459-479）
- **Virtual Scrolling** の説明が Advanced Performance Techniques と Performance Optimization for iPhone で重複
- **CSS Containment** の記述が重複

これはドキュメントの信頼性を損ない、将来的な更新時に不整合が生じるリスクがある。

---

#### 🟢 矛盾⑥ — CLAUDE.md の iOS バージョン

**CLAUDE.md の記述** (lines 361-366):
> OS: iOS 26.2.1 (latest), 26.2, 26.1, 26.0

**現実**: 2026年2月16日時点で iOS 26 は存在しない（iOS 18.x が最新）。この記述は将来予測または架空の仕様。

---

## 3. リファクタリング計画

### Phase A: ドキュメント整合性の修正（優先度: 最高）

| # | タスク | 対象ファイル | 詳細 |
|---|--------|-------------|------|
| A-1 | Web Worker 記述の更新 | `CLAUDE.md` | Worker削除の判断を反映し、記述を「将来検討」に変更。またはWorker再実装の判断を行う |
| A-2 | エージェント定義の統一 | `agents/QA.md`, `agents/UI.md` | `react-virtuoso` → `@tanstack/react-virtual` に修正 |
| A-3 | Image Handling重複削除 | `CLAUDE.md` | 2つの Image Handling セクションを1つに統合 |
| A-4 | PAGE_SIZE の記述統一 | `CLAUDE.md` | 例示 `PAGE_SIZE = 50` を実装の `200` と整合させるか、実装側を修正 |
| A-5 | テストカバレッジ表の更新 | `CLAUDE.md` | 現在のテスト実装状況を反映 |

### Phase B: コード品質改善（優先度: 高）

| # | タスク | 対象ファイル | 詳細 |
|---|--------|-------------|------|
| B-1 | initDb 一元化 | `src/App.tsx` | トップレベル `App` で一度だけ initDb を実行し、各ページラッパーの initDb 削除 |
| B-2 | ルーティング整理 | `src/App.tsx` | activeTab state + navigate の二重管理を解消。Outlet+ネストルートへ移行 |
| B-3 | `searchUtils.ts` テスト追加 | `src/utils/__tests__/` | CLAUDE.md で指定されたテスト対象 |
| B-4 | RecipeList PAGE_SIZE 検討 | `src/components/RecipeList.tsx` | 200→50 に戻すか、ソート条件を追加 |
| B-5 | ~~PWA アイコンセット~~ | `public/` | ✅ v2 (af1fd8b) で解消済み — 192/512 PNGアイコン追加済み |
| B-6 | 在庫マッチ率ロジック修正 | `src/utils/recipeUtils.ts` | `calculateMatchRate` の `main` カテゴリ限定を撤廃し、全材料を対象にマッチ率を計算。PM_REVIEW指摘の「重大バグ」に対応 |

### Phase C: UX/アーキテクチャ改善（優先度: 中）

| # | タスク | 対象ファイル | 詳細 |
|---|--------|-------------|------|
| C-1 | home/search URL分離 | `App.tsx`, `BottomNav.tsx` | `/search`, `/stock`, `/history` パスの導入 |
| C-2 | Worker再実装の検討 | `src/workers/` | 2000件規模でのFuse.js検索パフォーマンス計測→要否判断 |
| C-3 | FavoritesPage 仮想スクロール | `src/pages/FavoritesPage.tsx` | お気に入り件数増加に備えた予防的対応 |
| C-4 | Gantt競合の再帰チェック | `src/utils/recipeUtils.ts` | 3レシピ以上の同一デバイス競合時のシフト後再チェック |
| C-5 | UI/UX改善（PM_REVIEW統合） | `index.html`, `Header.tsx`, `StockManager.tsx` | iPhoneズーム抑制（viewport `maximum-scale=1`）、在庫管理UI改善（横スワイプ/直接編集）、ヘッダーボタンのタップ領域拡大（`p-2`→`p-3`） |
| C-6 | 閲覧履歴機能の実装 | `src/db/db.ts`, `RecipeDetail.tsx`, `HistoryPage.tsx`(新規) | `viewHistory` テーブル追加、レシピ閲覧時に履歴保存、履歴ページで日付降順表示（重複排除） |
| C-7 | ホーム画面の動的化 | `src/pages/HomePage.tsx`(新規) | 月/季節に応じた「旬の食材」レシピ推薦をホーム画面に表示し、ユーザーエンゲージメントを向上 |

---

## 4. 未コミット作業のコミット推奨

現在のワーキングツリーには大量の有効な修正が未コミット状態で存在する。**データ損失リスクを回避するため、これらを速やかにコミットすることを強く推奨する。**

推奨コミット構成：
1. `feat: add unit tests for recipeUtils, csvParser, geminiParser`
2. `feat: configure vite-plugin-pwa with workbox caching`
3. `fix: address QA findings — stockNames memo, initDb error handling, safe-area, aria-labels`
4. `refactor: remove unused search worker, update dependencies`

---

## 5. Next Actions（優先順位順）

1. **未コミット修正をコミット** — 現在の有効な修正が消失するリスクを排除
2. **Phase A（ドキュメント整合性修正）を実行** — CLAUDE.md とエージェント定義の矛盾を解消
3. **Phase B-1: initDb 一元化** — App.tsx の各ページラッパーの冗長な initDb を除去
4. **Phase B-2: ルーティング整理** — activeTab + navigate の二重管理を解消
5. **Phase B-3: searchUtils.ts テスト追加** — CLAUDE.md の指定カバレッジを満たす
6. **Phase B-6: 在庫マッチ率修正** — `main` カテゴリ限定を撤廃、全材料でマッチ率計算
7. **Phase C を計画的に実施** — C-5 UI/UX改善, C-6 閲覧履歴, C-7 ホーム画面動的化をスプリント計画に組み込む

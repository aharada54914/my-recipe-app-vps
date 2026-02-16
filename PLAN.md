# PM分析レポート & リファクタリング計画 (v4.0 — 2026-02-17)

> v4 からの差分: ユーザー報告6件（バグ2件+UI改善2件+機能追加2件）の根本原因分析と修正計画を追加。
> v3 からの差分: コードベース実検証により矛盾⑩(CSS Containment)の解消を確認、Phase C-6 を削除。
> 前回 (v2) からの差分: bbfc7be (QA修正一括コミット), 3dc2224 (レビュー統合+削除) を反映。

---

## 0. v4 新規課題（2026-02-17 ユーザー報告）

### 0-1. 課題一覧と根本原因

| # | 問題 | 根本原因 | 重要度 |
|---|------|---------|--------|
| BUG-1 | **在庫 0% バグ** | `db.stock.where('inStock').equals(1)` — Dexie v4 は boolean を boolean のまま IndexedDB に保存するため `1`(number) と `true`(boolean) が一致しない。RecipeList.tsx:37, HomePage.tsx:26 の2箇所 | 🔴 Critical |
| UI-1 | **在庫管理画面: トグル/削除重なり＋赤色** | `bg-bg-card = rgba(255,255,255,0.05)` (半透明) → 背後の `bg-red-500` (スワイプ削除用)が常時透過して見える。コード規約(不透明カード背景)違反 | 🔴 Critical |
| UI-2 | **検索画面: 画像のみ表示で不快** | RecipeCard が画像を上部全幅表示 (`rounded-t-2xl`)。料理名が画像の下に隠れ、一覧性が低い | 🟡 High |
| FEAT-1 | **在庫画面にデフォルト30品目** | StockManager にプリセット機能がない。ユーザーが1つずつ手動追加する必要あり | 🟡 High |
| FEAT-2 | **マルチスケジュール: 選択した料理のみ表示** | 全200件をボタン表示 → スクロール量が膨大で選択状態がわからない | 🟡 High |
| FEAT-3 | **ヘルシオデリを最下位** | ソート時にヘルシオデリ判定なし。対象: タイトルに「ヘルシオデリ」含む1件 + rawSteps に含む23件 = 計24件 | 🟢 Medium |

---

### 0-2. BUG-1: 在庫 0% バグ修正

**原因詳細:**

```typescript
// RecipeList.tsx:37, HomePage.tsx:26 — 現在のコード
db.stock.where('inStock').equals(1).toArray()
```

Dexie v4 (`^4.3.0`) は IndexedDB に `boolean` 型をそのまま保存する。`equals(1)` は number `1` と比較するため、`true` (boolean) とマッチしない → stockItems が常に空 → matchRate が常に 0%。

**修正:** `.equals(1)` → `.filter(item => item.inStock)` に変更（2箇所）

**対象ファイル:** `src/components/RecipeList.tsx`, `src/pages/HomePage.tsx`

---

### 0-3. UI-1: 在庫管理画面 UI 修正

**原因詳細:**

1. **赤色透過**: StockRow の削除背景が `bg-red-500` (absolute) で常時存在。前面カードの `bg-bg-card` が `rgba(255,255,255,0.05)` (95%透明) → 赤色が透けて見える
2. **重なり問題**: swipe-to-delete の赤背景と通常のカード要素が視覚的に干渉

**修正方針:**

1. `StockRow` の前面要素の背景を不透明色 (`bg-[#1a1a1c]`) に変更
2. スワイプ中のみ赤色背景を表示 (`offsetX > 0` のときだけ visible)

**対象ファイル:** `src/components/StockManager.tsx`

---

### 0-4. UI-2: 検索画面レイアウト改善

**現状:** RecipeCard は画像を上部に全幅表示。スクロールで料理名がほとんど見えず不快。

**修正方針 — コンパクトリストレイアウト:**
```
┌─────────────────────────────────────┐
│ [デバイス] [No.XXX]        ┌─────┐ │
│ 料理名（太字）             │48×48│ │
│ ⏱ XX分  X人分  在庫 XX%   └─────┘ │
└─────────────────────────────────────┘
```

- 画像を右側に `w-12 h-12` (`48×48`) の正方形サムネイルとして配置
- 料理名がメインの視覚要素になる

**対象ファイル:** `src/components/RecipeCard.tsx`, `src/components/RecipeImage.tsx`

---

### 0-5. FEAT-1: 在庫画面デフォルト30品目

**方針:** レシピデータから集計した上位30食材を定数定義。stock テーブルが空のとき自動挿入。

| # | 食材名 | 単位 | # | 食材名 | 単位 |
|---|--------|------|---|--------|------|
| 1 | 塩 | 適量 | 16 | オリーブオイル | 大さじ |
| 2 | しょうゆ | 大さじ | 17 | 牛乳 | ml |
| 3 | 砂糖 | 大さじ | 18 | にんにく | かけ |
| 4 | 酒 | 大さじ | 19 | しょうが | g |
| 5 | 水 | ml | 20 | 鶏もも肉 | 枚 |
| 6 | こしょう | 適量 | 21 | マヨネーズ | 大さじ |
| 7 | 玉ねぎ | 個 | 22 | ピーマン | 個 |
| 8 | バター | g | 23 | しめじ | g |
| 9 | にんじん | g | 24 | 青ねぎ | 本 |
| 10 | 卵 | 個 | 25 | じゃがいも | 個 |
| 11 | 片栗粉 | 大さじ | 26 | パプリカ | 個 |
| 12 | サラダ油 | 大さじ | 27 | だし汁 | ml |
| 13 | 薄力粉 | g | 28 | 酢 | 大さじ |
| 14 | みりん | 大さじ | 29 | ピザ用チーズ | g |
| 15 | ごま油 | 小さじ | 30 | 豚バラ肉 | g |

**対象ファイル:** 新規 `src/data/defaultStock.ts`, `src/components/StockManager.tsx`

---

### 0-6. FEAT-2: マルチスケジュール UI 改善

**現状:** 全200件がフラットなボタンで表示 → 目的のレシピが見つからず選択困難。

**修正方針 — 2段構成UI:**

1. **検索＋選択エリア** (上部): テキスト検索バー + 検索結果リスト (最大20件)
2. **選択済みチップ** (中部): アクセントカラーのチップ横並び、×ボタンで解除可能
3. **ガントチャート** (下部): 既存のまま

**対象ファイル:** `src/components/MultiScheduleView.tsx`

---

### 0-7. FEAT-3: ヘルシオデリを最下位表示

**対象レシピ判定:**
```typescript
function isHelsioDeli(recipe: Recipe): boolean {
  if (recipe.title.includes('ヘルシオデリ')) return true
  if (recipe.rawSteps?.some(s => s.includes('ヘルシオデリ'))) return true
  return false
}
```
対象: タイトル1件 + rawSteps 23件 = 計24件

**ソートロジック:** ヘルシオデリフラグで分離し末尾に配置、通常レシピは matchRate ソート維持

**対象ファイル:** `src/utils/recipeUtils.ts`, `src/components/RecipeList.tsx`, `src/pages/HomePage.tsx`

---

### 0-8. v4 実装順序と依存関係

```
Phase E1: バグ修正（即時・並行可能）
  ├── BUG-1: 在庫0%バグ         → RecipeList.tsx, HomePage.tsx
  └── UI-1:  在庫管理UI修正     → StockManager.tsx

Phase E2: UI改善
  └── UI-2:  RecipeCardレイアウト → RecipeCard.tsx, RecipeImage.tsx

Phase E3: 機能追加（並行可能、FEAT-3 は BUG-1 完了後）
  ├── FEAT-1: デフォルト30品目   → 新規 defaultStock.ts + StockManager.tsx
  ├── FEAT-2: マルチスケジュールUI → MultiScheduleView.tsx
  └── FEAT-3: ヘルシオデリ降格   → recipeUtils.ts, RecipeList.tsx, HomePage.tsx
```

**依存関係:**
- BUG-1, UI-1 → 独立、最初に修正
- UI-2 → 独立
- FEAT-1, FEAT-2 → 独立
- FEAT-3 → BUG-1 完了後（ソートが正しく機能するため）
- 全タスクは v3.1 の Phase A〜D とは独立して実施可能

---

## 1. 現状分析

### 1-1. プッシュ履歴サマリ（直近コミット）

| コミット | 内容 |
|----------|------|
| `ce108aa` (HEAD) | docs: PLAN.md v4.0 — 6件のバグ/UI/機能課題の根本原因分析と修正計画 |
| `3c84de4` | Phase D-3 + D-4: 在庫UI改善 + Gantt 再帰競合チェック |
| `badd8ec` | Phase D-1 + D-2: 閲覧履歴機能 + ホーム画面旬のおすすめ |
| `a2de02c` | Phase C-5: searchUtils テスト追加 |
| `c6efa32` | Phase C-2/3/4: Header aria-label + タップ領域拡大 + カテゴリ limit |
| `c751028` | Phase C-1: Outlet ベースのルーティングに再構成 |
| `710220b` | Phase B: CLAUDE.md ドキュメント整合性修正 (B-1〜B-7 + 追加) |
| `ca079b4` | Phase A-1 + A-2: initDb を App レベルに移動 + テスト基盤構築 |
| `bbfc7be` | fix: QA修正一括 — safe-area, aria-label, stockNames memo, Wake Lock修正, Worker削除, テスト追加, geminiParser検証 |
| `3dc2224` | docs: PLAN.md統合 + PM_REVIEW.md/REVIEW.md 削除 |
| `af1fd8b` | v2 Refactoring — プリビルドパイプライン, ブランディング(Kitchen App), PNGアイコン, エージェント定義更新, ImportPage削除 |

### 1-2. ワーキングツリー

v4 新規課題（Phase E1〜E3）は未実装。Phase A〜D は全て実装済み。

### 1-3. レビュー文書（統合済み — 元ファイルは削除）

以下のレビュー文書の知見はすべて本 PLAN.md に統合済み：
1. **REVIEW.md**（削除済み @3dc2224）— Gap分析 2-2 に包含
2. **PM_REVIEW.md**（削除済み @3dc2224）— 固有知見を Phase B/C に統合
3. **QA_REPORT.md**（`claude/qa-review-evaluation-5R0XQ` ブランチ、別管理）— Gap分析 2-1 に包含

---

## 2. 整合性チェック（Gap分析）

### 凡例
- ✅ **解消済み** = コミット済みで対応完了
- ⚠️ **部分対応** = 修正が不十分、または新たな矛盾が発生
- ❌ **未対応** = まだ対応されていない
- 🆕 **新規発見** = 本レビューで初めて特定

---

### 2-0. v2 リファクタリング (af1fd8b) + QA修正 (bbfc7be) で解消済みの項目

| 課題 | 対応内容 | コミット |
|------|---------|---------|
| データ戦略の変更（CSV→プリビルド） | `prebuild-recipes.mjs` + JSON バンドル + `ImportPage.tsx` 削除 + initDb で自動投入 | af1fd8b |
| ブランディング統一 | アプリ名「Kitchen App」、`ForkKnifeIcon.tsx`、192/512 PNGアイコン | af1fd8b |
| エージェント定義の更新 | `agents/*.md` の `react-virtuoso` → `@tanstack/react-virtual` 修正、マッチ率全材料対象化 | af1fd8b |
| Service Worker | `vite-plugin-pwa` + workbox 設定 | af1fd8b |
| PNGアイコンセット | `app-icon-192.png`, `app-icon-512.png` | af1fd8b |
| テスト追加 | `recipeUtils.test.ts`, `csvParser.test.ts`, `geminiParser.test.ts` | bbfc7be |
| stockNames メモ化 | `useMemo` でラップ | bbfc7be |
| MultiScheduleView 全件ロード | `.orderBy('title').limit(200)` に制限 | bbfc7be |
| JSON.parse 無検証 | `validateParsedRecipe` 実装 | bbfc7be |
| CSV toArray() | `orderBy('title').uniqueKeys()` に変更 | bbfc7be |
| BottomNav safe-area + aria-label | `env(safe-area-inset-bottom)` + `aria-label` 追加 | bbfc7be |
| Wake Lock リーク | `wakeLockRef` による適切なクリーンアップ | bbfc7be |
| initDb エラーハンドリング | `.catch()` 追加 | bbfc7be |
| 到達不能コード | `formatQuantityVibe` の dead branch 削除 | bbfc7be |
| Gemini API dynamic import | `@google/generative-ai` の遅延ロード | bbfc7be |
| Worker削除 | `search.worker.ts` 削除、メインスレッド実行に統一 | bbfc7be |
| 在庫マッチ率 | `calculateMatchRate` を全材料対象に修正（`main` 限定撤廃）| af1fd8b + bbfc7be |
| CSS Containment | `src/index.css` に `.recipe-card { contain: layout style paint; content-visibility: auto; }` 実装済み | bbfc7be |

---

### 2-1. 残存する QA_REPORT 指摘

| # | QA指摘 | 重要度 | 状態 | 詳細 |
|---|--------|--------|------|------|
| 4 | APIキー localStorage保存 | 🟡Medium | ✅解消済み | CLAUDE.md に注意事項追記済み @710220b |
| 7 | Worker方針と CLAUDE.md の矛盾 | 🟡Medium | ✅解消済み | Phase B-1 で Worker 記述を削除/格下げ @710220b |
| 8 | aria-label 網羅性 | 🟡Medium | ✅解消済み | Phase C-2 で Header.tsx に aria-label 追加 @c6efa32 |
| 10 | home/search 同一URL | 🟡Medium | ✅解消済み | Phase C-1 で Outlet + ネストルートに移行、URL 分離 @c751028 |
| 11 | バンドルサイズ | 🟡Medium | ⚠️部分対応 | dynamic import 実施済み、チャンク分割効果は要検証 |
| 17 | FavoritesPage 仮想スクロール | 🟢Low | ❌未対応 | 優先度低 |
| 18 | initDb 重複呼出 | 🟢Low | ✅解消済み | Phase A-1 で App レベルに移動、全ルートで保証 @ca079b4 |

### 2-2. 残存する REVIEW.md 指摘

| # | REVIEW指摘 | 状態 | 詳細 |
|---|------------|------|------|
| 3 | initDb 冗長呼出 | ✅解消済み | Phase A-1 で App レベルに移動 @ca079b4 |
| 4 | 塩分丸め処理の不一致 | ✅解消済み | LOGIC.md「小数第1位精度保持、表示時1g丸め」と実装が一致。CLAUDE.md line 41 も整合 |
| 5 | react-router-dom の非効率利用 | ✅解消済み | Phase C-1 で Outlet + ネストルートに移行 @c751028 |

---

### 2-3. CLAUDE.md の記述 vs 実装の矛盾（全件再検証）

#### ~~🔴 新規発見① — initDb が AppShell 外のルートで実行されない~~ → ✅ 解消済み @ca079b4

Phase A-1 で `App` コンポーネントレベルに `initDb()` を移動。`BrowserRouter` の外で `ready` 状態を管理し、全ルートで DB 初期化を保証。

---

#### ~~🔴 新規発見② — テスト実行基盤が完全に欠落~~ → ✅ 解消済み @ca079b4

Phase A-2 で `vitest` をインストール、`test` / `test:watch` スクリプトを追加。既存3テストが実行可能。

---

#### ~~🟡 矛盾① — Web Worker の記述と実装の乖離~~ → ✅ 解消済み @710220b

Phase B-1 で CLAUDE.md の Worker 推奨記述を「メインスレッド + useTransition で十分」に変更。

---

#### ~~🟡 矛盾② — CLAUDE.md 内の重複セクション~~ → ✅ 解消済み @710220b

Phase B-2/B-3 で Image Handling、Virtual Scrolling、CSS Containment、Web Workers の重複を統合・削除。

---

#### ~~🟡 矛盾③ — CLAUDE.md のコンポーネント名が実装と不一致~~ → ✅ 解消済み @710220b

Phase B-4 で `SearchHeader.tsx` → `SearchBar.tsx`、`StockSelector.tsx` → `StockManager.tsx` に修正。HomePage.tsx も反映。

---

#### ~~🟡 矛盾④ — PAGE_SIZE の不一致~~ → ✅ 解消済み @710220b + @c6efa32

Phase B-5 で CLAUDE.md の記述を統一、Phase C-4 でカテゴリフィルタにも `.limit(PAGE_SIZE)` を適用。

---

#### ~~🟡 矛盾⑤ — Header ボタンのタップ領域~~ → ✅ 解消済み @c6efa32

Phase C-3 で Header.tsx の全ボタンを `p-2` → `p-3` に変更。

---

#### ~~🟡 矛盾⑥ — PWA 記述の陳腐化~~ → ✅ 解消済み @710220b

Phase B-6 で CLAUDE.md の PWA 記述を現在の設定内容に更新。

---

#### ~~🟡 矛盾⑦ — Image Handling Checklist の CSV 参照~~ → ✅ 解消済み @710220b

Phase B-2 で CSV import 参照を削除。

---

#### ~~🟡 矛盾⑧ — searchUtils.ts テスト未実装~~ → ✅ 解消済み @a2de02c

Phase C-5 で `src/utils/__tests__/searchUtils.test.ts` を追加。

---

#### ~~🟢 矛盾⑨ — iOS バージョン~~ → ✅ 解消済み @710220b

Phase B-7 で iOS 26.x → iOS 18.x、iPhone 17 → iPhone 16 に修正。

---

#### ~~🟢 矛盾⑩ — CSS Containment 未実装~~ → ✅ 解消済み @bbfc7be

`src/index.css` に `.recipe-card { contain: layout style paint; content-visibility: auto; contain-intrinsic-size: auto 120px; }` が実装済み。

---

#### 🟢 矛盾⑪ — react-blurhash 未インストール

**CLAUDE.md** (line 216): "Library: `react-blurhash` (requires npm install)"
**実装**: `package.json` に含まれず。BlurHash 機能は未実装。優先度低のため保留。

---

## 3. リファクタリング計画（Phase A〜D: ✅ 全件実装済み）

### Phase A: 緊急修正 — ✅ 完了 @ca079b4

| # | タスク | 状態 | コミット |
|---|--------|------|---------|
| A-1 | **initDb を App レベルに移動** | ✅ 完了 | ca079b4 |
| A-2 | **テスト実行基盤の構築** | ✅ 完了 | ca079b4 |

### Phase B: ドキュメント整合性の修正 — ✅ 完了 @710220b

| # | タスク | 状態 | コミット |
|---|--------|------|---------|
| B-1 | Web Worker 記述の削除/格下げ | ✅ 完了 | 710220b |
| B-2 | Image Handling 重複統合 | ✅ 完了 | 710220b |
| B-3 | Performance セクション重複削除 | ✅ 完了 | 710220b |
| B-4 | コンポーネント名の修正 | ✅ 完了 | 710220b |
| B-5 | PAGE_SIZE 記述の統一 | ✅ 完了 | 710220b |
| B-6 | PWA 記述の更新 | ✅ 完了 | 710220b |
| B-7 | iOS バージョンの修正 | ✅ 完了 | 710220b |

### Phase C: コード品質改善 — ✅ 完了 @c751028, @c6efa32, @a2de02c

| # | タスク | 状態 | コミット |
|---|--------|------|---------|
| C-1 | ルーティング整理 (Outlet + ネストルート) | ✅ 完了 | c751028 |
| C-2 | Header aria-label 追加 | ✅ 完了 | c6efa32 |
| C-3 | Header タップ領域拡大 (`p-2` → `p-3`) | ✅ 完了 | c6efa32 |
| C-4 | RecipeList カテゴリフィルタに limit 追加 | ✅ 完了 | c6efa32 |
| C-5 | `searchUtils.ts` テスト追加 | ✅ 完了 | a2de02c |

### Phase D: UX/アーキテクチャ改善 — ✅ 完了 @badd8ec, @3c84de4

| # | タスク | 状態 | コミット |
|---|--------|------|---------|
| D-1 | 閲覧履歴機能の実装 | ✅ 完了 | badd8ec |
| D-2 | ホーム画面の動的化 (旬のおすすめ) | ✅ 完了 | badd8ec |
| D-3 | 在庫管理UI改善 (スワイプ削除、数量編集) | ✅ 完了 | 3c84de4 |
| D-4 | Gantt 競合再帰チェック | ✅ 完了 | 3c84de4 |

---

## 4. 依存関係グラフ（Phase A〜D: 全完了）

```
✅ A-1 (initDb移動) ──→ ✅ C-1 (ルーティング整理) ──→ ✅ D-1 (閲覧履歴)
                                                      ──→ ✅ D-2 (ホーム動的化)
✅ A-2 (テスト基盤) ──→ ✅ C-5 (searchUtils テスト)

✅ B-1 (Worker記述) ──→ ✅ B-3 (Performance重複削除)
```

---

## 5. Next Actions（現在の優先順位）

Phase A〜D は全て実装済み。**v4 新規課題 (Phase E1〜E3) が残作業。**

1. **Phase E1: BUG-1 在庫0%バグ** — Dexie v4 boolean 型不一致を修正（🔴 Critical）
2. **Phase E1: UI-1 在庫管理画面UI** — 赤色透過 + トグル/削除重なり修正（🔴 Critical）
3. **Phase E2: UI-2 検索画面レイアウト** — コンパクトリスト化（🟡 High）
4. **Phase E3: FEAT-1 デフォルト30品目** — 在庫プリセット自動挿入（🟡 High）
5. **Phase E3: FEAT-2 マルチスケジュールUI** — 検索＋チップ選択UI（🟡 High）
6. **Phase E3: FEAT-3 ヘルシオデリ降格** — 検索/おすすめで末尾表示（🟢 Medium）
7. **残課題: QA#11 バンドルサイズ検証** — チャンク分割効果の確認（⚠️ 部分対応）
8. **残課題: QA#17 FavoritesPage 仮想スクロール** — 優先度低（❌ 未対応）
9. **残課題: 矛盾⑪ react-blurhash** — 優先度低（❌ 未対応）

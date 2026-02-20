# PM分析レポート & リファクタリング計画 (v5.0 — 2026-02-20)

> v5 からの差分: Phase E（v4.0 計画分）の全実装を確認・完了マーク。Phase F（設定タブ化・Gantt改善・週間献立2タイル化・副菜提案・時刻表示・モーダル）の実装を記録。残タスクの実現可能性を客観的に評価。
> v4 からの差分: ユーザー報告6件（BUG-1, UI-1, UI-2, FEAT-1〜3）の根本原因分析と修正計画を追加。

---

## 0. ステータス概観

| Phase | 概要 | 状態 |
|-------|------|------|
| A | 緊急修正（initDb移動・テスト基盤） | ✅ 完了 |
| B | ドキュメント整合性修正 | ✅ 完了 |
| C | コード品質改善 | ✅ 完了 |
| D | UX/アーキテクチャ改善 | ✅ 完了 |
| E1 | バグ修正（在庫0%バグ・StockManager UI） | ✅ 完了 |
| E2 | UI改善（検索画面レイアウト） | ✅ 完了 |
| E3 | 機能追加（デフォルト在庫・マルチスケジュールUI・ヘルシオデリ降格） | ✅ 完了 |
| F | 設定タブ化・Gantt改善・週間献立2タイル化・副菜提案 | ✅ 完了 |
| G | 残課題（自動スケジューラ・仮想スクロール・バンドル検証） | ⚠️ 残課題 |

---

## 1. 現状分析

### 1-1. プッシュ履歴サマリ（直近コミット）

| コミット | 内容 |
|----------|------|
| `73a9e2c` (HEAD) | feat: 設定タブ化・Gantt改善・週間献立2タイル・副菜提案・時刻表示・Ganttモーダル |
| `7c182d2` | docs: 岡崎弁バージョンのセットアップガイドを追加 |
| `25f7e5b` | docs: 個人設定ガイド(SETUP_GUIDE.md)を日本語で追加 |
| `4e931c1` | Merge branch 'main' |
| `6819dc3` | chore: sync plan.md from remote |
| `c244351` | feat: UI/UX refactor + ingredient master system ← Phase E 相当 |
| `e33605f` | sorting programs |
| `d163ab9` | 在庫管理用データ |
| `52c9906` | docs: rewrite README, REFACTORING_PLAN and add docs/ folder in English |
| `1f6d0a3` | feat: Phase 6-12 週間献立・トップページ刷新・材料/手順タブ・逆算スケジュール |

### 1-2. ワーキングツリー

`73a9e2c` HEAD = Phase F 全件実装済み。未実装は Phase G の3件のみ。

---

## 2. Phase E — 実装確認（v4.0 計画の完了確認）

### E1: BUG-1 在庫0%バグ ✅ 完了

- **修正箇所**: `src/components/RecipeList.tsx:81`, `src/pages/HomePage.tsx:89`
- `db.stock.where('inStock').equals(1)` → `db.stock.filter(item => item.inStock)` に変更済み
- Dexie v4 の boolean 型不一致問題を解消

### E1: UI-1 StockManager 全面再設計 ✅ 完了（設計変更で解消）

- スワイプ削除UIを廃止 → 数量入力ベースのシンプルなUIに全面再設計
- `STOCK_MASTER`（164品目）から食材リストを生成、数量0で「在庫なし」扱い
- 赤色透過・トグル重なりの問題を根本的に解消

### E2: UI-2 RecipeCard コンパクトレイアウト ✅ 完了

- RecipeCard に `variant` prop 追加（`'default'` | `'list'` | `'menu'`）
- `'list'` variant: 左テキスト・右48×48サムネイルの横並びレイアウト
- `'menu'` variant: 週間献立タイル用コンパクト表示（h-20画像・text-[11px]）

### E3: FEAT-1 デフォルト在庫プリセット ✅ 完了

- `src/data/stockMaster.ts` 作成（164品目、カテゴリ付き）
- `src/db/initDb.ts` でDB初期化時に自動挿入
- `StockManager.tsx` が `STOCK_MASTER` を食材インデックスとして使用

### E3: FEAT-2 マルチスケジュール UI 改善 ✅ 完了

- `MultiScheduleView.tsx` に検索バー + `useDebounce(300ms)` 追加
- 検索結果から最大件数表示 + 選択済みチップで管理
- `.orderBy('title').limit(200)` によるクエリ上限制御

### E3: FEAT-3 ヘルシオデリ降格 ✅ 完了

- `src/utils/recipeUtils.ts` に `isHelsioDeli()` 追加（タイトル + rawSteps で判定）
- `RecipeList.tsx` / `HomePage.tsx` のソートロジックで末尾に降格

---

## 3. Phase F — 新機能実装（2026-02-20 @73a9e2c）

### F-1: 設定画面タブ化 ✅ 完了

- `SettingsPage.tsx` を5タブ構成に再設計
- タブ: **アカウント** / **カレンダー** / **献立** / **通知** / **データ**
- スティッキーなタブバー（アイコン付き）でヘッダー直下に固定
- Gemini APIキーを「献立」タブに移動

### F-2: Gantt チャートテキスト改善 ✅ 完了

- `MultiScheduleView.tsx` のバー高さを `h-9` → `h-14` に拡大
- `whitespace-nowrap` → `whitespace-normal break-all leading-tight` に変更
- 2行表示: ステップ名（text-[9px]）+ 時刻範囲（text-[8px]）
- 幅が5%未満のバーはテキスト非表示、15%未満は時刻非表示

### F-3: 副菜自動提案 ✅ 完了

- `db.ts` の `WeeklyMenuItem` に `sideRecipeId?: number` フィールド追加
- `weeklyMenuSelector.ts` に2パス処理追加（1パス目: 主菜、2パス目: 副菜/スープ）
- 副菜スコアリング: 在庫マッチ率 × 3.0 + 旬ボーナス + 多様性ペナルティ

### F-4: 週間献立2タイルレイアウト ✅ 完了

- `WeeklyMenuPage.tsx` を完全再設計
- 1日 = 横2タイル（主菜タイル | 副菜/スープタイル）
- RecipeCard `'menu'` variant を活用したコンパクト表示
- 主菜/副菜それぞれに独立したスワップボタン（↻）

### F-5: 調理開始時刻・いただきます時刻表示 ✅ 完了

- WeeklyMenuPage の各日に時刻行を追加
- 「🔪 XX:XX 〜 🍽 XX:XX」形式で調理開始・完成時刻を表示
- 時刻をタップすると F-6 のGanttモーダルを開く

### F-6: Gantt チャートデイモーダル ✅ 完了

- `WeeklyMenuPage.tsx` 内に `GanttDayModal` コンポーネント追加
- 底から引き出すボトムシート形式
- 主菜のGanttチャート（`ScheduleGantt`）を表示
- `state: { modalRecipeId, modalDate }` で管理

### F-7: PreferencesContext バグ修正 ✅ 完了

- `PreferencesContext.tsx` の `useLiveQuery` が `undefined`（読み込み中）と `null`（DB空）を区別できないバグを修正
- クエリ結果に `return prefs ?? null` を追加し、空DBを確実に検出

### F-8: WeeklyMenuTimeline 副菜表示 ✅ 完了

- `WeeklyMenuTimeline.tsx` がコンパクトモードで副菜タイトルをサブテキストとして表示
- `sideRecipeId` を `bulkGet` で取得して表示

---

## 4. Phase G — 残課題と実現可能性評価

### G-1: 週間献立 自動スケジューラ ❌ 未実装

**概要:** `weeklyMenuGenerationDay/Hour/Minute` の設定値に基づいて、毎週自動で献立生成を実行する仕組み。

**実現可能性: ⚠️ 中〜難**

| 手段 | 実現性 | 備考 |
|------|--------|------|
| Service Worker `setInterval` | ❌ 不可 | iOS はバックグラウンドでSW停止。アプリ起動時のみ動作 |
| Web Push + SW Background Sync | ⚠️ 部分的 | iOS 16.4+ でPush対応。ただし自己サーバーが必要 |
| Supabase Edge Functions (cron) | ✅ 可能 | Supabase Pro プランのScheduled Functions機能。サーバーサイドで確実に実行可能 |
| アプリ起動時チェック（簡易版） | ✅ 実装容易 | 起動時に「前回生成から7日経過かチェック」→ 自動生成提案のトースト通知 |

**推奨アプローチ:** まず「アプリ起動時チェック + トースト提案」で体験を改善し、将来的にSupabase Edge Functions対応。

**工数見積もり:** 起動時チェック版 = 1〜2h。Supabase cron版 = 4〜8h（Supabaseプロジェクト設定含む）。

---

### G-2: FavoritesPage 仮想スクロール ❌ 未実装（優先度低）

**概要:** お気に入りが大量になった場合のDOM削減。

**実現可能性: ✅ 容易**

- `@tanstack/react-virtual` は CLAUDE.md 推奨、ただし **package.json に未追加**（`npm install` が必要）
- `FavoritesPage.tsx` の RecipeCard リストを `useVirtualizer` でラップするだけ
- カード高さ 88px のエスティメートで動作可能

**現実的な重要度評価:** お気に入りは通常30〜100件程度。2000件超えるユーザーはほぼいないため、**実装しなくても実用上問題なし**。タスクとして保留が妥当。

**工数見積もり:** npm install + 実装 = 1〜2h。

---

### G-3: バンドルサイズ検証と最適化 ⚠️ 部分対応

**概要:** `@google/generative-ai` の dynamic import は実施済み。チャンク分割の効果を `npm run build` で確認・最適化。

**実現可能性: ✅ 容易**

現在の推定ボトルネック:

| 依存 | 推定サイズ | 状態 |
|------|-----------|------|
| `recipes-hotcook.json` | ~150KB | バンドル内に含まれる（変更不可） |
| `recipes-healsio.json` | ~500KB | バンドル内に含まれる（変更不可） |
| `@google/generative-ai` | ~200KB | dynamic import 済み ✅ |
| `dexie` + `dexie-react-hooks` | ~100KB | 削減困難 |
| `date-fns` | ~50KB（tree-shaken） | 最適化済み |

レシピJSONは設計上バンドルに含まれる（プリビルドパイプライン）。主要な削減余地は限定的。

**推奨アクション:** `npm run build` の出力でチャンクサイズを確認。`vite-bundle-visualizer` で可視化（`npx vite-bundle-visualizer`）。

**工数見積もり:** 確認 = 30min。最適化（必要な場合）= 1〜3h。

---

### G-4: react-blurhash ❌ 未実装（優先度低）

**概要:** CLAUDE.md に記載があるが、`package.json` 未収録・機能未実装。

**実現可能性: ✅ 容易だが効果限定的**

- 外部CDN画像（`cocoroplus.jp.sharp`）に BlurhHash データが存在しない可能性が高い
- Service Worker の CacheFirst でオフラインキャッシュ済みのため、読み込み体験は十分
- **結論: CLAUDE.md から記述を削除し、実装しないことが推奨**

**工数見積もり:** CLAUDE.md 修正 = 5min。

---

### G-5: ホームページ補完 ⚠️ 部分対応（Phase 10 残課題）

| 項目 | 状態 | 工数 | 優先度 |
|------|------|------|--------|
| ホームページ内検索バー | ❌ 未実装 | 30min | 🟢 Low |
| 「時短レシピ」セクション（≤30分） | ❌ 未実装 | 1h | 🟢 Low |
| BottomNav 4タブ化 | ❌ 未実装 | 30min | 🟢 Low（現状5タブで機能している）|

---

## 5. 整合性チェック（累積 Gap 分析）

### 凡例
- ✅ **解消済み** = コミット済みで対応完了
- ⚠️ **部分対応** = 修正が不十分、または新たな矛盾が発生
- ❌ **未対応** = まだ対応されていない

### 未解消の矛盾一覧

| # | 矛盾/課題 | 重要度 | 状態 | 詳細 |
|---|-----------|--------|------|------|
| QA#11 | バンドルサイズ | 🟡 Medium | ⚠️ 部分対応 | dynamic import 実施済み、サイズ検証未実施 |
| QA#17 | FavoritesPage 仮想スクロール | 🟢 Low | ❌ 未対応 | 実用上問題なし（G-2参照） |
| 矛盾⑪ | react-blurhash 未インストール | 🟢 Low | ❌ 未対応 | CLAUDE.md から削除推奨（G-4参照） |

### 全解消済み矛盾（累積）

Phase A〜F で解消済みの全矛盾は PLAN.md v4.0 の Section 2 に記録済み。主要なものを再掲:

| 矛盾 | 解消コミット |
|------|-------------|
| initDb 重複呼出 | ca079b4 |
| テスト実行基盤欠落 | ca079b4 |
| Web Worker 記述乖離 | 710220b |
| コンポーネント名不一致 | 710220b |
| CSS Containment 未実装 | bbfc7be |
| 在庫0%バグ (Dexie v4 boolean) | c244351 |
| StockManager 赤色透過 | c244351（設計変更）|
| PreferencesContext undefined/null 混同 | 73a9e2c |
| seasonalPriority 低以外選べない | 73a9e2c |

---

## 6. アーキテクチャ現況サマリ

```
src/
├── components/
│   ├── MultiScheduleView.tsx     ← 検索UI・チップ選択・Gantt (Phase E3 + F2)
│   ├── RecipeCard.tsx            ← variant: default | list | menu (Phase E2 + F4)
│   ├── ScheduleGantt.tsx         ← 逆算スケジュール表示
│   ├── StockManager.tsx          ← 数量ベースUI・STOCK_MASTER 164品目 (Phase E1)
│   └── WeeklyMenuTimeline.tsx    ← 副菜サブタイトル付き (Phase F8)
├── contexts/
│   ├── AuthContext.tsx
│   └── PreferencesContext.tsx    ← null/undefined バグ修正 (Phase F7)
├── data/
│   ├── stockMaster.ts            ← 164品目マスター (Phase E3)
│   ├── synonyms.ts               ← 食材シノニム辞書
│   └── seasonalIngredients.ts    ← 旬食材データ
├── db/
│   ├── db.ts                     ← WeeklyMenuItem.sideRecipeId 追加 (Phase F3)
│   └── initDb.ts                 ← STOCK_MASTER 自動挿入 (Phase E3)
├── pages/
│   ├── SettingsPage.tsx          ← 5タブ構成 (Phase F1)
│   └── WeeklyMenuPage.tsx        ← 2タイルレイアウト・GanttDayModal (Phase F4-6)
└── utils/
    ├── recipeUtils.ts            ← isHelsioDeli() (Phase E3)
    └── weeklyMenuSelector.ts     ← 副菜2パス選択 (Phase F3)
```

---

## 7. 次アクション（優先順位）

Phase G 残課題の推奨実施順:

| 優先度 | タスク | 工数 | 判断 |
|--------|--------|------|------|
| 🟡 Medium | G-3: バンドルサイズ検証 | 30min | 実施推奨（確認のみ） |
| 🟡 Medium | G-1: 起動時チェック版 自動スケジューラ | 1〜2h | 実施推奨（UX改善） |
| 🟢 Low | G-4: CLAUDE.md から react-blurhash 記述削除 | 5min | 実施推奨（ドキュメント整合） |
| 🟢 Low | G-5: ホームページ検索バー追加 | 30min | オプション |
| 🟢 Low | G-2: FavoritesPage 仮想スクロール | 1〜2h | 保留で可 |

---

## 8. 実現可能性の客観的評価

### ✅ 高実現可能（即実装可能）

| 項目 | 根拠 |
|------|------|
| G-3 バンドルサイズ確認 | `npm run build` 実行 + `npx vite-bundle-visualizer` で即確認可能 |
| G-4 CLAUDE.md修正 | 5分の編集作業 |
| G-5 ホームページ検索バー | 既存SearchPageへのナビゲーション実装のみ |
| G-2 仮想スクロール | @tanstack/react-virtual の導入パターンは確立済み |

### ⚠️ 中程度の複雑さ

| 項目 | 根拠 | リスク |
|------|------|--------|
| G-1 起動時チェック版 | App.tsx に日付チェックロジックを追加するだけ | 低 |
| G-1 Supabase Edge Functions版 | Supabase設定・デプロイが必要 | 中（環境依存） |

### ❌ 現時点で実装困難

| 項目 | 根拠 |
|------|------|
| G-1 iOS バックグラウンド自動実行 | iOS の制約でWebアプリからは不可能。PWA でも Background Fetch は未対応 |
| G-4 BlurhHash（外部CDN画像） | CDN が BlurhHash データを提供していないため、ハッシュ生成が不可能 |

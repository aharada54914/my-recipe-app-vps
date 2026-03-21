# Phase 5 Visual Refresh Plan

最終更新: 2026-03-07

## 目的

- `Liquid Glass` 依存の見た目をやめる
- スマホでの視認性、押しやすさ、読みやすさを上げる
- `Warm Tactile Kitchen` をライト / ダーク両対応で成立させる
- 以後の UI 改修でテーマ差分が破綻しないよう、トークンと primitives を再設計する

## 非交渉要件

- ダークモードは後回しにしない
- ライトだけ、またはダークだけで完成扱いにしない
- 全主要画面で `light` / `dark` の両方を同品質で成立させる
- テーマは `system / light / dark` の 3 モードを持つ
- 初回表示でテーマがちらつかない

## 前提

- 主利用端末はスマホ
- Google / Gemini は中核機能
- UI は `Warm Tactile Kitchen` を採用する
- 旧来の translucent glass 表現は撤去対象

## 現状診断

### 1. テーマの持ち方が不完全

- 現在の中心は [index.css](/Users/jrmag/my-recipe-app/src/index.css)
- デフォルト値は dark だが、`prefers-color-scheme: light` で一部上書きしている
- ユーザーが明示的にテーマを選ぶ状態管理がない
- `system` と手動指定の優先順位が設計されていない

### 2. semantic token と直書き色が混在

- `bg-bg-card` などの token 利用がある一方で、`bg-white/5`, `ring-white/10`, `text-accent`, `backdrop-blur-*` が各所に散在
- 結果としてテーマ切替時の保証範囲が曖昧

### 3. app chrome が glass 前提

- [Header.tsx](/Users/jrmag/my-recipe-app/src/components/Header.tsx)
- [BottomNav.tsx](/Users/jrmag/my-recipe-app/src/components/BottomNav.tsx)
- [SettingsPage.tsx](/Users/jrmag/my-recipe-app/src/pages/SettingsPage.tsx)

これらは blur / 半透明白に寄っており、ライト / ダークの両方に最適化されていない。

### 4. ページごとの文法が揃っていない

- [HomePage.tsx](/Users/jrmag/my-recipe-app/src/pages/HomePage.tsx)
- [WeeklyMenuPage.tsx](/Users/jrmag/my-recipe-app/src/pages/WeeklyMenuPage.tsx)
- [RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx)
- [StockManager.tsx](/Users/jrmag/my-recipe-app/src/components/StockManager.tsx)
- [AskGeminiPage.tsx](/Users/jrmag/my-recipe-app/src/pages/AskGeminiPage.tsx)

Phase 2-4 で UX は良くなっているが、見た目はまだ 1 つの製品言語に揃っていない。

## デザイン方針

### 方針名

- `Warm Tactile Kitchen`

### 共通方向性

- ガラスではなく、マットな面と紙ラベル的な質感
- 情報の区切りは影より余白と面差
- 役割ごとに色を分ける
- 文字サイズ差は抑え、読みながら操作できる密度にする

### ライトテーマ

- 生成り寄りの背景
- 白すぎない暖色面
- 調理ラベル、献立カード、メモ紙の印象

### ダークテーマ

- 黒ベースは維持するが、青黒ではなく少し温度のある炭色
- 単なる反転ではなく、暖色アクセントが沈まないように別設計
- 面はガラスではなく、濃色の紙・陶器・鋳物に近い質感

### ライトとダークの関係

- ダークはライトの別案ではなく、同じ `Warm Tactile Kitchen` の夜版とする
- hierarchy、役割色、余白設計、コンポーネント形状は共通で固定する
- 変えるのは主に「明度」「面の深さ」「境界の出し方」

具体化:

- primary CTA は light / dark ともに同じ位置、同じ意味
- `fresh`, `ai`, `warning`, `error` の役割色はテーマをまたいで維持
- 面の階層差は light では明度差、dark では明度差 + 薄い境界で表現

### ダークテーマ追加方針

- ライトの生成り面を、ダークでは `warm charcoal + muted bronze` 系へ変換する
- pure black は使わず、長時間見ても疲れにくい濃色面にする
- pure white 文字は見出しと主要値だけに限定し、本文は少し落とす
- 画像 overlay は dark でさらに 1 段整理し、ラベルやチップが潰れないようにする

## Paired Theme Spec

### ライト基準

- 紙、木、ラベル、まな板、キッチンメモ
- 軽く乾いた質感

### ダーク基準

- 炭色、鉄器、陶器、夜のキッチンカウンター
- しっとりしたマット感

### 禁止事項

- dark を単純な light の色反転で作らない
- dark で border を消しすぎて面が溶ける状態を許容しない
- dark でアクセント色を neon 化しない
- light / dark でコンポーネントの余白設計を変えない

## テーマアーキテクチャ

### 追加する設定

- `appearanceMode: 'system' | 'light' | 'dark'`

実装対象:

- [db.ts](/Users/jrmag/my-recipe-app/src/db/db.ts)
- [preferencesContextDef.ts](/Users/jrmag/my-recipe-app/src/contexts/preferencesContextDef.ts)
- [PreferencesContext.tsx](/Users/jrmag/my-recipe-app/src/contexts/PreferencesContext.tsx)
- Settings UI

### テーマ解決ルール

1. ユーザー設定が `light` または `dark` ならそれを優先
2. `system` のときだけ `prefers-color-scheme` を参照
3. 実際に適用された値を `resolvedTheme` として DOM に反映

### DOM 反映方式

- `document.documentElement.dataset.theme = 'light' | 'dark'`
- CSS token は `:root[data-theme="light"]`, `:root[data-theme="dark"]` に定義

### 初回ちらつき対策

- React mount 前に theme bootstrap を実行
- localStorage と system preference から即時解決して `data-theme` を入れる
- `meta[name="theme-color"]` もテーマに応じて更新

対象:

- [index.html](/Users/jrmag/my-recipe-app/index.html) または同等の bootstrap 挿入点
- [App.tsx](/Users/jrmag/my-recipe-app/src/App.tsx)

## トークン再設計

### Token 層を 2 段に分ける

1. Core tokens
   - raw color values
   - radius
   - spacing
   - shadow

2. Semantic tokens
   - canvas
   - surface
   - border
   - text
   - accent by role

理由:

- ライト / ダークで値は変わるが、意味は変えないため

### Semantic token 一覧

- `--color-canvas`
- `--color-canvas-muted`
- `--color-surface-1`
- `--color-surface-2`
- `--color-surface-3`
- `--color-surface-inset`
- `--color-border-soft`
- `--color-border-strong`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-text-tertiary`
- `--color-accent-primary`
- `--color-accent-primary-hover`
- `--color-accent-fresh`
- `--color-accent-ai`
- `--color-warning`
- `--color-error`
- `--color-success`
- `--shadow-soft`
- `--shadow-card`

### paired token 案

#### Light

- `--color-canvas`: `#F5EFE6`
- `--color-canvas-muted`: `#ECE3D6`
- `--color-surface-1`: `#FFF8F0`
- `--color-surface-2`: `#F6EBDD`
- `--color-surface-3`: `#E7D5BF`
- `--color-surface-inset`: `#EDE2D3`
- `--color-border-soft`: `#D8C7B3`
- `--color-border-strong`: `#B89F86`
- `--color-text-primary`: `#2B241C`
- `--color-text-secondary`: `#66594B`
- `--color-text-tertiary`: `#8B7A67`

#### Dark

- `--color-canvas`: `#191613`
- `--color-canvas-muted`: `#221D18`
- `--color-surface-1`: `#26201B`
- `--color-surface-2`: `#312821`
- `--color-surface-3`: `#3B3028`
- `--color-surface-inset`: `#201A15`
- `--color-border-soft`: `#4E4035`
- `--color-border-strong`: `#6D5A4B`
- `--color-text-primary`: `#F5EDE3`
- `--color-text-secondary`: `#D0C0B1`
- `--color-text-tertiary`: `#A89482`

#### Accent roles shared across themes

- `--color-accent-primary`: `#D97706`
- `--color-accent-primary-hover`: `#B85F00`
- `--color-accent-fresh`: `#5E8D62`
- `--color-accent-ai`: `#3A9189`
- `--color-warning`: `#B8833E`
- `--color-error`: `#B35C4B`
- `--color-success`: `#628C68`

### 役割別色ルール

- 調理 / 主要 CTA: `accent-primary`
- 在庫 / 旬 / 成功: `accent-fresh`
- Gemini / AI / 補助知能: `accent-ai`
- 警告: `warning`
- エラー: `error`

### component-level dark rules

- Card:
  - light は面差中心
  - dark は `surface + soft border` を必須にする
- Input:
  - dark では inset 面を使い、外周 border を 1 段強くする
- BottomNav:
  - dark では bar 自体を 1 段濃くして、active item は背景より label と icon の contrast を優先
- Status notice:
  - dark では情報色を明るくしすぎず、背景を濃くして文字を浮かせる
- Recipe image:
  - dark では overlay をやや強めにし、ラベル文字の白飛びを防ぐ

## UI Primitive 再編

### 改修対象 primitives

- `ui-shell`
- `ui-surface`
- `ui-card`
- `ui-card-muted`
- `ui-panel`
- `ui-input`
- `ui-btn-primary`
- `ui-btn-secondary`
- `ui-btn-fresh`
- `ui-btn-ai`
- `ui-chip`
- `ui-chip-active`
- `ui-badge-*`
- `ui-nav-item`
- `ui-status-*`

### 廃止対象

- `bg-white/5`, `bg-white/8`, `bg-white/10`
- `ring-white/10`, `ring-white/15`
- `backdrop-blur-*` を主要導線で使う設計
- ランダムな `text-accent` の流用

## 実装フェーズ

## Phase 5-0: Theme Foundation

目的:

- ライト / ダーク両対応の土台を作る

作業:

- [index.css](/Users/jrmag/my-recipe-app/src/index.css) を core / semantic token ベースへ再編
- `:root[data-theme="light"]`, `:root[data-theme="dark"]` を導入
- 既存の `prefers-color-scheme: light` 上書きを撤去
- theme bootstrap を追加して FOUC を防ぐ
- `appearanceMode` を preferences に追加するマイグレーション計画を入れる
- paired token matrix を light / dark 同時に定義する
- `theme-color` を theme ごとに切り替える

完了条件:

- ルート DOM の `data-theme` だけで配色が切り替わる
- 初回表示でテーマちらつきがない

## Phase 5-1: Theme Controls And Persistence

目的:

- ユーザーがテーマを制御できるようにする

作業:

- Settings に `system / light / dark` 切替 UI を追加
- 設定変更時に即座に DOM へ反映
- preferences に保存
- OS の配色変更も `system` 時のみ追従

対象:

- Preferences context / repository
- Settings pages

完了条件:

- 手動テーマ選択と system 追従が安定して動く

## Phase 5-2: App Chrome Refresh

目的:

- 全ページの第一印象を作り直す

対象:

- [Header.tsx](/Users/jrmag/my-recipe-app/src/components/Header.tsx)
- [BottomNav.tsx](/Users/jrmag/my-recipe-app/src/components/BottomNav.tsx)
- [SettingsPage.tsx](/Users/jrmag/my-recipe-app/src/pages/SettingsPage.tsx)

作業:

- Header の glass / blur を撤去
- BottomNav をラベル付きにする
- active state を light / dark 両方で視認可能な文法にする
- safe area と border の見え方を両テーマで揃える
- dark では chrome が暗さで潰れないよう、canvas と chrome surface の差を必ず作る

完了条件:

- app chrome だけでテーマの完成度が分かる

## Phase 5-3: Primary Screens Refresh

目的:

- 主導線を新しい見た目で成立させる

対象:

- [HomePage.tsx](/Users/jrmag/my-recipe-app/src/pages/HomePage.tsx)
- [WeeklyMenuPage.tsx](/Users/jrmag/my-recipe-app/src/pages/WeeklyMenuPage.tsx)
- [CategoryGrid.tsx](/Users/jrmag/my-recipe-app/src/components/CategoryGrid.tsx)
- [WeeklyMenuTimeline.tsx](/Users/jrmag/my-recipe-app/src/components/WeeklyMenuTimeline.tsx)

作業:

- ホームの hierarchy を再整理
- 週間献立のサマリー、日別カード、下部 action のトーンを統一
- ライト / ダーク双方で CTA が埋もれないように色設計を微調整
- dark で画像、天気、推薦理由タイルの overlay と文字可読性を別確認する

完了条件:

- Home と WeeklyMenu が両テーマで同品質

## Phase 5-4: Secondary Screens Refresh

目的:

- 残りの主要操作画面を統一する

対象:

- [RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx)
- [SearchBar.tsx](/Users/jrmag/my-recipe-app/src/components/SearchBar.tsx)
- [StockManager.tsx](/Users/jrmag/my-recipe-app/src/components/StockManager.tsx)
- [AskGeminiPage.tsx](/Users/jrmag/my-recipe-app/src/pages/AskGeminiPage.tsx)
- [ImportTab.tsx](/Users/jrmag/my-recipe-app/src/components/gemini/ImportTab.tsx)
- [SuggestTab.tsx](/Users/jrmag/my-recipe-app/src/components/gemini/SuggestTab.tsx)
- [ChatTab.tsx](/Users/jrmag/my-recipe-app/src/components/gemini/ChatTab.tsx)
- [AccountTab.tsx](/Users/jrmag/my-recipe-app/src/components/settings/AccountTab.tsx)
- [MenuTab.tsx](/Users/jrmag/my-recipe-app/src/components/settings/MenuTab.tsx)

作業:

- 検索 / 在庫 / AI / 設定を semantic token に移行
- status card の配色を light / dark で個別調整
- icon, border, disabled, empty state を両テーマで確認
- dark で chip 群、検索履歴、在庫候補、Gemini status が同じ濃度に見えないよう差をつける

完了条件:

- 主要 6 画面が同一の UI 文法で揃う

## Phase 5-5: Dual Theme QA And Cleanup

目的:

- テーマ崩れを残さない

作業:

- `bg-white/*`, `ring-white/*`, `text-accent`, `backdrop-blur` などを grep で洗い出す
- semantic token に置換
- visual regression を light / dark の両方で保存
- `theme-color`, splash, PWA 表示色も確認

完了条件:

- テーマ差分が CSS 変数と primitives に集約される

## 実装順

1. Theme foundation
2. Theme controls and persistence
3. Header / BottomNav / Settings shell
4. Home / WeeklyMenu
5. Search / Stock / Gemini / Settings tabs
6. Cleanup and dual-theme QA

## PR 分割案

1. `phase5/theme-foundation`
   - tokens
   - data-theme
   - bootstrap
   - no FOUC

2. `phase5/theme-settings`
   - preference field
   - migration
   - settings UI
   - persistence

3. `phase5/app-chrome-dual-theme`
   - header
   - bottom nav
   - settings shell

4. `phase5/primary-screens-dual-theme`
   - home
   - weekly menu
   - category grid
   - weekly timeline

5. `phase5/secondary-screens-dual-theme`
   - search
   - stock
   - gemini
   - settings tabs

6. `phase5/theme-cleanup-qa`
   - hardcoded class cleanup
   - visual regression
   - accessibility polish

## 受け入れ基準

- `system / light / dark` の 3 モードがある
- テーマ変更は即時反映され、再起動後も保持される
- 初回表示でライト / ダークのちらつきがない
- Home / WeeklyMenu / Search / Stock / Gemini / Settings の 6 画面が両テーマで視認性を満たす
- BottomNav はラベル付きで、両テーマで現在地が明確
- 主要 CTA は両テーマで埋もれない
- 成功 / 注意 / エラー / AI の色が両テーマで区別できる
- ダークモードがライトテーマの反転ではなく、同じ製品言語として成立している

## QA 観点

### Functional

- `system` で OS 変更に追従する
- `light` / `dark` 固定時は OS 変更に影響されない
- テーマ変更で hydration mismatch や layout shift が出ない

### Visual

- iPhone SE 幅
- 標準 iPhone 幅
- やや広いスマホ幅

各幅で `light` / `dark` を確認する。

screen matrix:

- Home
- WeeklyMenu
- Search
- Stock
- Gemini
- Settings

各画面で以下を見る:

- empty
- normal
- active / selected
- loading
- error

### Accessibility

- 本文、補助文、disabled、badge のコントラスト
- focus ring
- icon only button の認識性

## リスク

- テーマの状態管理を後付けすると、初回表示ちらつきが起きやすい
- PWA の `theme-color` と splash の色を揃えないと、ブラウザ chrome だけ浮く
- glass 廃止と dark 完全対応を同時にやるため、単なる配色入替では終わらない

## 非目標

- このフェーズでは新しい大きなアニメーション体系は作らない
- ブランドロゴ刷新は必須ではない
- デスクトップ専用最適化は優先しない

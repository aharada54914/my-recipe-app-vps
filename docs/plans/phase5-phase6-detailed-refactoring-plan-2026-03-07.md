# Phase 5 / Phase 6 Detailed Refactoring Plan

最終更新: 2026-03-07

この計画は [phase5-visual-refresh-plan-2026-03-07.md](/Users/jrmag/my-recipe-app/docs/plans/phase5-visual-refresh-plan-2026-03-07.md) を実装計画レベルに展開し、今回のスマホ実地監査、Google 連携 QA モード導入、既存 Phase 0-4 の変更を踏まえて再編したものです。

## 1. 前提

- 主利用端末はスマホ
- 日次の主要導線は `レシピ検索` と `AI に相談`
- スクロール量は強く抑制する
- Google 連携と Gemini は中核機能
- 見た目は `Warm Tactile Kitchen` を採用する
- ライト方針は維持しつつ、ダークは同じ製品言語の夜版として作る
- 既存ユーザーデータの完全互換は必須ではないが、破壊的変更は管理下で行う

## 2. これまでを踏まえた現状診断

### 2.1 テーマ実装はまだ glass 時代の構造を引きずっている

- [src/index.css](/Users/jrmag/my-recipe-app/src/index.css) は `prefers-color-scheme` ベースの簡易上書きに留まり、`system / light / dark` の明示管理がない
- `bg-white/5`, `ring-white/10`, `backdrop-blur-*`, `liquid-background` が広く残っている
- semantic token より、見た目直書きが強い

### 2.2 アプリ共通導線の UI 文法がスマホに最適化されていない

- [src/components/BottomNav.tsx](/Users/jrmag/my-recipe-app/src/components/BottomNav.tsx) はラベルなし、半透明 bar、active state 弱め
- [src/components/Header.tsx](/Users/jrmag/my-recipe-app/src/components/Header.tsx) は utility が詰まり気味で、ログイン状態や主要導線の優先順位が曖昧
- 固定 bar と本文の間の「安全余白」の責務が画面ごとにぶれている

### 2.3 主要画面の優先導線がまだ分散している

- [src/pages/HomePage.tsx](/Users/jrmag/my-recipe-app/src/pages/HomePage.tsx) は検索、旬、カテゴリ、週間献立、Gemini が同時に競合している
- [src/pages/WeeklyMenuPage.tsx](/Users/jrmag/my-recipe-app/src/pages/WeeklyMenuPage.tsx) は生成後の情報量が多く、スマホでは縦方向の負担が大きい
- `買い物リスト` と `カレンダー登録` は、今後さらに「別タスク」として分離した方がよい

### 2.4 Google / Gemini の「接続済み状態」の監査基盤は入ったが、正式な QA 動線としてはまだ粗い

- QA モード自体は導入済み
  - [src/lib/qaGoogleMode.ts](/Users/jrmag/my-recipe-app/src/lib/qaGoogleMode.ts)
  - [src/lib/googleDrive.ts](/Users/jrmag/my-recipe-app/src/lib/googleDrive.ts)
  - [src/lib/googleCalendar.ts](/Users/jrmag/my-recipe-app/src/lib/googleCalendar.ts)
- ただし、今は `設定 > データ` に寄せた最小構成で、正式な `connected-flow regression harness` にはなっていない

### 2.5 テストは通っているが、構造が単一 smoke に寄りすぎている

- unit test 群は厚い
- ただし E2E は [tests/smoke/app.smoke.spec.ts](/Users/jrmag/my-recipe-app/tests/smoke/app.smoke.spec.ts) に集中している
- テーマ切替、Google 接続済み導線、QA モード、BottomNav、safe-area、スクロール量の検証が独立していない

## 3. Phase 5 の目的

Phase 5 は単なる見た目変更ではなく、次の 5 つを同時に達成するフェーズと定義する。

1. `Warm Tactile Kitchen` の paired theme を完成させる
2. スマホでの主要導線を短くし、迷いを減らす
3. Google / Gemini の中核体験を接続済み状態まで含めて一貫させる
4. 既存の glass / translucent 前提 UI を置き換える
5. Phase 6 の削除と統合に耐えるテスト構成へ移行する

## 4. Phase 5 詳細計画

## Phase 5-0: Theme Foundation

### 目的

- テーマ制御を CSS メディアクエリ依存から脱却させる
- `system / light / dark` を正式なユーザー設定として持つ
- 初回表示でテーマがちらつかない

### 作業

- `appearanceMode: 'system' | 'light' | 'dark'` を user preferences に追加
- theme bootstrap を `index.html` か同等の初期化点に追加し、React mount 前に `data-theme` を解決する
- `:root[data-theme='light']` と `:root[data-theme='dark']` に paired token を定義する
- 既存 token を `core tokens` と `semantic tokens` に再編する
- `liquid-background` を新しい背景表現へ置換する
- `theme-color` を light/dark に応じて切り替える

### 影響ファイル

- [src/index.css](/Users/jrmag/my-recipe-app/src/index.css)
- [src/App.tsx](/Users/jrmag/my-recipe-app/src/App.tsx)
- [src/contexts/PreferencesContext.tsx](/Users/jrmag/my-recipe-app/src/contexts/PreferencesContext.tsx)
- [src/contexts/preferencesContextDef.ts](/Users/jrmag/my-recipe-app/src/contexts/preferencesContextDef.ts)
- [src/db/db.ts](/Users/jrmag/my-recipe-app/src/db/db.ts)
- Settings 内の見た目設定 UI

### 受け入れ条件

- `system`, `light`, `dark` の切り替えが再読込後も保持される
- 初回ロードで FOUC が発生しない
- light/dark で同じ semantic class を使って見た目が成立する

### テスト改廃

- 追加:
  - `themeResolver.test.ts`
  - `appearancePreferences.test.ts`
  - `themeBootstrap.test.ts`
- 追加:
  - Playwright `theme.spec.ts`
    - system -> light/dark の反映
    - 手動切替の保持
    - `meta[name="theme-color"]` の更新
- 廃止:
  - `prefers-color-scheme` 依存だけを前提にした古い説明・テスト

## Phase 5-1: App Chrome Redesign

### 目的

- スマホでの第一印象と常時操作導線を整理する
- fixed UI と本文の干渉をなくす

### 作業

- [src/components/BottomNav.tsx](/Users/jrmag/my-recipe-app/src/components/BottomNav.tsx) をラベル付きへ変更
- active tab を `icon + label + indicator` で明示する
- 全画面に `main safe area contract` を導入し、固定 bar と本文の重なりをなくす
- [src/components/Header.tsx](/Users/jrmag/my-recipe-app/src/components/Header.tsx) を整理し、utility の数を減らす
- ログイン導線は `設定` または `アカウント CTA` に寄せ、2 行折返しの可能性を潰す
- 共通 layout shell を定義し、各画面の `pb-24`, `backdrop-blur-*` の乱立を減らす

### 影響ファイル

- [src/components/BottomNav.tsx](/Users/jrmag/my-recipe-app/src/components/BottomNav.tsx)
- [src/components/Header.tsx](/Users/jrmag/my-recipe-app/src/components/Header.tsx)
- [src/App.tsx](/Users/jrmag/my-recipe-app/src/App.tsx)
- [src/pages/SettingsPage.tsx](/Users/jrmag/my-recipe-app/src/pages/SettingsPage.tsx)
- 画面ごとの `main` wrapper

### 受け入れ条件

- BottomNav は常にラベル付き
- active tab が一目で分かる
- Search / Gemini / Shopping List の末尾要素が nav に隠れない
- Header は 390px 幅でも窮屈に見えない

### テスト改廃

- 追加:
  - `BottomNav.test.tsx`
  - `Header.test.tsx`
- 追加:
  - Playwright `navigation.spec.ts`
    - tab ラベル表示
    - active tab 変化
    - fixed nav 重なりなし
- 更新:
  - 既存 smoke の `home shows core entry points`
  - `settings page renders tab list`
- 廃止:
  - icon-only nav を前提にした aria 依存 selector

## Phase 5-2: Home / Search / Gemini Priority Reflow

### 目的

- 日次の主要導線である `検索` と `AI相談` をホームで最短化する
- above-the-fold を整理する

### 作業

- [src/pages/HomePage.tsx](/Users/jrmag/my-recipe-app/src/pages/HomePage.tsx) を再構成
  - 1st block: 検索 CTA
  - 2nd block: AI に相談
  - 3rd block: 今週の献立サマリー
  - 4th block 以降: 旬 / カテゴリ / 補助導線
- 「説明文」より「要約値」「次に押すボタン」を優先する
- Search は結果画面への接続を強化し、最近の検索 / 最近見たレシピ / quick chips の視覚階層を揃える
- Gemini は未設定・使用可能・制限中で hero area の見せ方を切り替える

### 影響ファイル

- [src/pages/HomePage.tsx](/Users/jrmag/my-recipe-app/src/pages/HomePage.tsx)
- [src/components/RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx)
- [src/pages/AskGeminiPage.tsx](/Users/jrmag/my-recipe-app/src/pages/AskGeminiPage.tsx)
- [src/components/gemini/ImportTab.tsx](/Users/jrmag/my-recipe-app/src/components/gemini/ImportTab.tsx)
- [src/components/gemini/SuggestTab.tsx](/Users/jrmag/my-recipe-app/src/components/gemini/SuggestTab.tsx)

### 受け入れ条件

- ホームで「検索」と「AI相談」が 1 スクロール以内に収まる
- 未設定時でも「次に何をするか」が 1 CTA で分かる
- Search / Gemini の導線がテーマ差分なしで読める

### テスト改廃

- 追加:
  - `HomePage.test.tsx`
  - `GeminiEntryState.test.tsx`
- 追加:
  - Playwright `home-priority.spec.ts`
  - Playwright `gemini-entry.spec.ts`
- 更新:
  - 既存 smoke `home shows core entry points`
  - `search keeps typed Japanese query order`

## Phase 5-3: Weekly Menu / Shopping Mobile Compression

### 目的

- 週間献立をスマホの縦スクロールに強い構造へ変える
- `今見るもの` と `後でやるもの` を分離する

### 作業

- `今週サマリー` を最上段に固定
- 日別カードは `今日` を強調し、それ以外は condensed list か accordion にする
- `推薦理由`, `栄養`, `天気`, `買い物` の情報を 1 枚の長い縦列にしない
- 買い物リストは `sheet` または独立 route 化を検討し、主画面から分離する
- fixed action bar は「今の状態で必要な操作」だけを残す
- カレンダー登録や共有の結果は、カード内ステータスと toast に統一する

### 影響ファイル

- [src/pages/WeeklyMenuPage.tsx](/Users/jrmag/my-recipe-app/src/pages/WeeklyMenuPage.tsx)
- [src/hooks/useWeeklyMenuController.ts](/Users/jrmag/my-recipe-app/src/hooks/useWeeklyMenuController.ts)
- `weekly/` 配下の modal / card / list component 群

### 受け入れ条件

- 生成後に最初の 1 画面で「今週の状態」が把握できる
- 今日の献立確認から買い物導線までのスクロール量が減る
- 7 日分カードが視覚的に同格で並び続けない

### テスト改廃

- 追加:
  - `WeeklySummaryCard.test.tsx`
  - `WeeklyActionBar.test.tsx`
  - `WeeklyShoppingSheet.test.tsx`
- 追加:
  - Playwright `weekly-menu-mobile.spec.ts`
    - 空状態
    - 生成後
    - 交換
    - 買い物リスト
- 更新:
  - 既存 weekly smoke 群を `weekly-menu-core.spec.ts` と `weekly-menu-editing.spec.ts` に分割
- 廃止:
  - 常に 7 枚フル表示を前提にした selector の一部

## Phase 5-4: Connected UX Formalization

### 目的

- Google / Gemini の接続済み体験を、本番・QA・失敗系まで一貫させる
- QA モードを正式な回帰テスト装置として扱う

### 作業

- QA モードを `settings/data` の便利機能ではなく、`connected-flow harness` として定義する
- [src/components/settings/AccountTab.tsx](/Users/jrmag/my-recipe-app/src/components/settings/AccountTab.tsx) と [src/lib/integrationStatus.ts](/Users/jrmag/my-recipe-app/src/lib/integrationStatus.ts) の状態表現を整理する
- [src/components/CalendarSettings.tsx](/Users/jrmag/my-recipe-app/src/components/CalendarSettings.tsx) と [src/components/CalendarRegistrationModal.tsx](/Users/jrmag/my-recipe-app/src/components/CalendarRegistrationModal.tsx) の接続済み状態を共通の UI primitive に寄せる
- Gemini 側も、未設定・復号待ち・使用可能・残量警告・失敗を同じ見た目ルールで揃える
- QA モードの URL と state 管理をドキュメント化し、将来は `dev-only panel` へ寄せるか判断する

### 追加事項

- Google 連携済み実体験の監査を継続できるよう、QA モードに以下を追加検討
  - モック event 一覧
  - モック backup メタデータ表示
  - reset one-click
  - route deep-link presets
- Gemini にも将来的な QA モードを用意し、失敗再現をしやすくする

### 影響ファイル

- [src/lib/qaGoogleMode.ts](/Users/jrmag/my-recipe-app/src/lib/qaGoogleMode.ts)
- [src/lib/googleDrive.ts](/Users/jrmag/my-recipe-app/src/lib/googleDrive.ts)
- [src/lib/googleCalendar.ts](/Users/jrmag/my-recipe-app/src/lib/googleCalendar.ts)
- [src/components/settings/DataTab.tsx](/Users/jrmag/my-recipe-app/src/components/settings/DataTab.tsx)
- [src/components/settings/AccountTab.tsx](/Users/jrmag/my-recipe-app/src/components/settings/AccountTab.tsx)
- [src/components/CalendarSettings.tsx](/Users/jrmag/my-recipe-app/src/components/CalendarSettings.tsx)
- [src/components/CalendarRegistrationModal.tsx](/Users/jrmag/my-recipe-app/src/components/CalendarRegistrationModal.tsx)

### 受け入れ条件

- `?qa-google=1` で接続済み状態に入り、Backup / Restore / Calendar registration が通る
- 失敗時・未設定時・QA 時で UI の文法が揃う
- スマホで接続状態を誤認しない

### テスト改廃

- 追加:
  - `qaGoogleMode.test.ts`
  - `integrationStatus.test.ts`
  - `googleDrive.qa.test.ts`
  - `googleCalendar.qa.test.ts`
- 追加:
  - Playwright `google-qa-mode.spec.ts`
    - QA mode enable
    - mock backup
    - mock restore
    - calendar list
    - event creation
- 更新:
  - 既存 settings smoke
- 廃止:
  - 実 Google 依存で不安定になるローカル手動検証だけの運用

## Phase 5-5: Accessibility / Contrast / Motion / Performance Polish

### 目的

- 見た目刷新を「実用レベル」まで仕上げる

### 作業

- 主要状態カード、QA カード、warning/error/info card の contrast を監査する
- 44px 以上のタップ領域を保証する
- animation は `page-load`, `sheet open`, `card stagger` など意味のあるものだけに絞る
- `jsQR`, Gemini, 設定の分割チャンクは再点検し、初期表示の妨げを減らす
- `content-visibility`, virtualization, deferred loading を再評価する

### 受け入れ条件

- contrast の重大問題が残らない
- 片手操作で押しづらい小ボタンが主要導線に残らない
- Home / Search / Gemini 初期表示で体感遅延が目立たない

### テスト改廃

- 追加:
  - a11y lint / custom assertions
  - performance budget check
- 追加:
  - Playwright screenshot 比較
    - light home
    - dark home
    - weekly menu
    - settings/account
    - QA mode
- 更新:
  - smoke の selector を role / testid 優先へ整理

## 5. Phase 5 の PR 分割

### PR-1 Theme Foundation

- appearanceMode
- data-theme bootstrap
- token 再設計
- base primitives

### PR-2 App Chrome

- Header
- BottomNav
- layout shell
- safe-area contract

### PR-3 Home / Search / Gemini Priority Reflow

- Home 再編
- Search の visual grammar 統一
- Gemini entry area 整理

### PR-4 Weekly Menu Mobile Compression

- summary first
- shopping sheet/route
- compact day cards

### PR-5 Connected UX

- Google / Gemini connected states
- QA mode 正式化
- calendar / backup UX 統一

### PR-6 Polish

- contrast
- a11y
- motion
- performance
- screenshot baselines

## 6. テスト再編計画

## 6.1 Unit Test

### 新規追加

- theme resolver
- appearance preference persistence
- qaGoogleMode
- googleDrive qa adapter
- googleCalendar qa adapter
- integrationStatus
- BottomNav active logic
- Header account rendering

### 改修

- UI store test は toast と theme side effects の境界を明確化する
- startup UI test は theme bootstrap との責務分離を明確にする

## 6.2 Component Test

### 新規追加

- Home hero blocks
- BottomNav
- StatusNotice
- CalendarSettings QA banner
- CalendarRegistrationModal QA banner
- Weekly summary / shopping sheet

### 改廃方針

- snapshot 乱用はしない
- role と visible copy を基準にした assertion を優先する
- 見た目確認は Playwright screenshot へ寄せる

## 6.3 E2E / Smoke Test

現在の [tests/smoke/app.smoke.spec.ts](/Users/jrmag/my-recipe-app/tests/smoke/app.smoke.spec.ts) は責務が広すぎるため、以下へ分割する。

- `tests/smoke/navigation.spec.ts`
- `tests/smoke/home-search-ai.spec.ts`
- `tests/smoke/weekly-menu.spec.ts`
- `tests/smoke/stock-search.spec.ts`
- `tests/smoke/settings-preferences.spec.ts`
- `tests/smoke/theme.spec.ts`
- `tests/smoke/google-qa-mode.spec.ts`

### 追加する E2E 観点

- light / dark / system の切替
- fixed nav による隠れがない
- Google QA mode backup/restore/event creation
- 週間献立の compact 表示でも主要編集が可能
- Home で主要 CTA が 1 スクロール以内

### 削るもの

- `app.smoke.spec.ts` の 1 ファイル集中構成
- 旧レイアウトや旧文言に強く結びついた selector

## 7. Phase 6 詳細計画

Phase 6 は「見た目の仕上げ」ではなく、Phase 5 完了後に残る過渡資産を削除し、構造を収束させるフェーズとする。

## Phase 6-0: Legacy Theme / Glass Removal

### 目的

- Phase 5 完了後も残る glass 前提の class と token を削除する

### 作業

- `liquid-background`, `bg-white/5`, `ring-white/10`, `backdrop-blur-*` の全廃棚卸し
- 旧 accent 運用の除去
- 旧 dark-only デザイン指示の残骸を整理

### 完了条件

- 新 token/primitives 以外でテーマ差分を持たない
- glass 依存クラスが主要画面から消える

## Phase 6-1: Preferences / Storage Cleanup

### 目的

- 設定と localStorage の過渡キーを削る

### 作業

- `appearanceMode` 導入後の migration を確定
- 旧 theme 関連 key があれば削除
- QA mode の key を devtool 仕様として明文化する
- Google / Gemini 旧 key の整理方針を決める

### 完了条件

- localStorage / IndexedDB の key 管理表がある
- 不要 key の削除が migration に反映される

## Phase 6-2: Feature Boundary Cleanup

### 目的

- 画面とロジックの境界を Phase 5 の見た目刷新後にもう一段きれいにする

### 作業

- `weekly/`, `settings/`, `gemini/`, `search/`, `stock/` ごとに feature folder を再点検
- page-level composition と domain/service 層の責務を明確化する
- design primitives を `components/ui` へ集約する

### 完了条件

- UI primitive と feature component の境界が明確
- 画面ごとの直書きスタイルが大幅に減る

## Phase 6-3: Quality Gates and Regression Harness

### 目的

- 以後の改善で退行しない状態を作る

### 作業

- Playwright の screenshot baseline を CI に組み込む
- Theme / QA mode / weekly menu の回帰 suite を nightly でも回せるようにする
- QA mode の seeded scenario を複数用意する
  - empty
  - connected
  - connected with backup
  - connected with calendar events

### 完了条件

- UI regressions を PR で検知できる
- Google 実アカウントなしで connected-flow を回帰確認できる

## Phase 6-4: Performance Budget and Bundle Reduction

### 目的

- UI の完成後に残る技術負債を数値で締める

### 作業

- `index`, `SettingsPage`, `WeeklyMenuPage`, `jsQR`, Gemini 系 chunk を再監査
- 予算を設定する
  - app shell JS
  - first route JS
  - settings chunk
  - AI chunk
- route-level split と on-demand loading を再調整する

### 完了条件

- 予算超過が CI で分かる
- 初期ロードに不要な chunk が減る

## Phase 6-5: Docs and Operationalization

### 目的

- 開発運用の基準を文書化し、属人性を減らす

### 作業

- UI token guide
- theme rules
- QA mode usage
- screenshot regression の更新手順
- connected-flow test guide

### 完了条件

- 新規開発でも UI 文法を崩しにくい
- QA / PM / 開発の検証手順が共有可能

## 8. 実装順の推奨

1. Phase 5-0 Theme Foundation
2. Phase 5-1 App Chrome Redesign
3. Phase 5-4 Connected UX Formalization
4. Phase 5-2 Home / Search / Gemini Priority Reflow
5. Phase 5-3 Weekly Menu / Shopping Mobile Compression
6. Phase 5-5 Accessibility / Contrast / Motion / Performance Polish
7. Phase 6-0 Legacy Theme / Glass Removal
8. Phase 6-1 Preferences / Storage Cleanup
9. Phase 6-2 Feature Boundary Cleanup
10. Phase 6-3 Quality Gates and Regression Harness
11. Phase 6-4 Performance Budget and Bundle Reduction
12. Phase 6-5 Docs and Operationalization

## 9. 成功指標

- ホームで `検索` または `AI相談` に到達するまでの平均タップ数が減る
- 週間献立の生成後に必要スクロール量が減る
- Google / Gemini の未設定・接続済み・失敗状態で離脱が減る
- QA モードで connected-flow 回帰確認が可能になる
- light / dark いずれでも contrast 重大問題が残らない
- smoke / screenshot / unit test の責務が分離され、壊れた場所が特定しやすくなる

## 10. 着手時の注意

- Phase 5 の開始時点で `見た目だけ先に変える` のは禁止
- 最初の PR で token / theme bootstrap / safe-area contract を入れる
- `bg-white/5` などの置換は、テーマ基盤なしに場当たりで進めない
- QA モードは今後の本番検証を楽にする資産なので、Phase 6 で消す前提ではなく `dev harness` として育てる

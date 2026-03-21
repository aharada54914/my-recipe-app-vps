# Search Screen IME / Layout Refactor Plan

Last updated: 2026-03-07
Target: `/search` screen

## 1. Requested Changes

- `最近見たレシピ` タイルを廃止する
- `カテゴリ` を横スクロールなしで選べる UI にする
- `てばもと` のような日本語入力時に画面が固まり、`bmてばも` のような壊れた入力になる問題を止める
- UI 改善だけで終わらせず、テストを追加して再発防止する

## 2. Current Findings

Relevant files:

- [src/components/RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx)
- [src/components/SearchBar.tsx](/Users/jrmag/my-recipe-app/src/components/SearchBar.tsx)
- [src/hooks/useSearchInputController.ts](/Users/jrmag/my-recipe-app/src/hooks/useSearchInputController.ts)
- [src/components/CategoryTags.tsx](/Users/jrmag/my-recipe-app/src/components/CategoryTags.tsx)
- [src/utils/recipeSearchModel.ts](/Users/jrmag/my-recipe-app/src/utils/recipeSearchModel.ts)
- [tests/smoke/navigation.spec.ts](/Users/jrmag/my-recipe-app/tests/smoke/navigation.spec.ts)
- [src/components/__tests__/SearchBar.test.ts](/Users/jrmag/my-recipe-app/src/components/__tests__/SearchBar.test.ts)

### 2.1 `最近見たレシピ` は現在の検索主導線に不要

`RecipeList.tsx` では、未入力かつフィルタなしのときに `最近の検索` と `最近見たレシピ` の両方を出しています。

問題:

- 検索画面の初期表示が長い
- 入力欄直下の重要領域を消費する
- 今回の検索用途では `最近の検索` の方が再利用価値が高い

結論:

- `最近見たレシピ` は削除対象

### 2.2 `カテゴリ` は横スクロール前提で、全体像が見えない

`CategoryTags.tsx` は `overflow-x-auto` の 1 列構成です。

問題:

- 全カテゴリが初見で見えない
- 1 画面内で比較しづらい
- スマホ片手操作で「カテゴリ選択」が探索的になりやすい

結論:

- スマホ幅では 2 行以上の wrap / grid に変更すべき

### 2.3 IME 問題の直接原因は「入力中に重い更新が走りすぎる」こと

現状の検索入力経路は次の通りです。

1. `SearchBar` の controlled input が毎入力で `draftValue` を更新
2. `useSearchInputController` が 150ms debounce 後に親へ commit
3. `RecipeList` が `searchQuery` 更新を受けて:
   - `setSearchParams()` で URL を毎回更新
   - `buildRecipeSearchResults()` を再実行
   - `buildFacetAwareCategoryCounts()` も再実行
   - 仮想リスト全体の再計算を実行

特に重い箇所:

- `RecipeList.tsx`
  - 入力のたびに URL 同期を実行
- `recipeSearchModel.ts`
  - `searchQuery` が変わるだけでも、好みプロファイルと全件 base score を再計算

これは 1,700 件規模でもスマホ IME には十分重いです。

### 2.4 IME ハンドリング自体も防御が弱い

`useSearchInputController.ts` は `compositionstart / compositionend` に対応していますが、次が弱いです。

- focus 中でも debounce commit を走らせる
- URL 更新タイミングを IME 状態と切り離していない
- suggestion overlay が focus 中は常に候補を出し、入力中の視覚ノイズになる
- Android / Gboard 系で event 順序が揺れた場合の保護が薄い

結論:

- 「IME 中は親 state と URL を触らない」境界を明確に切るべき

## 3. Root Cause Summary

今回の症状は単一原因ではなく、次の複合です。

1. 検索入力中に重い検索モデル再計算が走る
2. 同時に URL 同期も走る
3. controlled input が mobile IME の変換中状態と競合する
4. その結果、キーボードイベント順序が乱れた端末で壊れた入力が見える

つまり本質は:

- `IME safety` の不足
- `search computation pipeline` の責務分離不足

です。

## 4. Refactor Goals

### Functional

- 日本語 IME で壊れた入力が起きない
- カテゴリを横スクロールなしで選べる
- `最近見たレシピ` を削除する

### UX

- 検索欄直下を短く保つ
- 入力中は UI が落ち着いている
- 条件選択が一覧で一目で分かる

### Quality

- IME / URL / 検索計算の責務を分離する
- 再発防止テストを unit / smoke の両方に追加する

## 5. Refactor Plan

### Phase 1: Search Screen Cleanup

対象:

- [src/components/RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx)
- [src/components/CategoryTags.tsx](/Users/jrmag/my-recipe-app/src/components/CategoryTags.tsx)

実施内容:

1. `最近見たレシピ` セクションを削除
2. `カテゴリ` を横スクロールから grid / wrap レイアウトへ変更
3. `すべて / 主菜 / 副菜 / スープ / 一品料理 / スイーツ` が初期表示で全部見えることを保証

推奨 UI:

- 2 列または 3 列 grid
- `すべて` だけ 2 列 span でもよい
- カウントは残すが視認性を落とさない

### Phase 2: IME-Safe Input Pipeline

対象:

- [src/components/SearchBar.tsx](/Users/jrmag/my-recipe-app/src/components/SearchBar.tsx)
- [src/hooks/useSearchInputController.ts](/Users/jrmag/my-recipe-app/src/hooks/useSearchInputController.ts)

実施内容:

1. `draft value` を入力専用 state として維持
2. IME 合成中は:
   - 親 state へ commit しない
   - URL 同期しない
   - suggestion overlay を抑制する
3. commit は次のどれかでのみ実行
   - `compositionend`
   - `Enter / 検索ボタン`
   - 合成していない通常入力の idle 後
4. input 属性を見直す
   - `spellCheck={false}`
   - `autoCorrect="off"`
   - `autoCapitalize="none"`
   - `enterKeyHint="search"`

狙い:

- mobile IME と React state 更新の衝突を減らす

### Phase 3: Search Computation Split

対象:

- [src/components/RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx)
- [src/utils/recipeSearchModel.ts](/Users/jrmag/my-recipe-app/src/utils/recipeSearchModel.ts)
- [src/hooks/useRecipeSearchModel.ts](/Users/jrmag/my-recipe-app/src/hooks/useRecipeSearchModel.ts)

実施内容:

1. `query-independent` な処理を事前計算へ分離
   - preference profile
   - base score
   - stock score
2. `query-dependent` な処理だけを入力時に再計算
   - Fuse 検索
   - facet filter 適用
   - final merge
3. category counts も `query-dependent` と `query-independent` を分けて軽量化

狙い:

- 検索欄入力時の main-thread 負荷を大幅に減らす

### Phase 4: URL Sync Policy Change

対象:

- [src/components/RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx)

実施内容:

1. URL 更新を「毎キー入力」から外す
2. URL へ反映するタイミングを次に限定
   - submit
   - blur
   - IME 非合成状態での安定後
3. facet ボタン操作は即 URL 反映のままでよい

狙い:

- router state 更新を IME 入力から切り離す

### Phase 5: Suggestion / Empty State UX Cleanup

対象:

- [src/components/SearchBar.tsx](/Users/jrmag/my-recipe-app/src/components/SearchBar.tsx)
- [src/components/RecipeList.tsx](/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx)

実施内容:

1. suggestion overlay の表示条件を厳格化
   - focus している
   - かつ非合成
   - かつ入力が空に近い
2. overlay の最大高さを制限
3. `最近の検索` は残すが、入力中の妨げにならない位置と高さにする
4. zero-result 時は `条件を1つ外す / すべて解除` を維持

## 6. Test Plan

### Unit / Hook

対象:

- [src/components/__tests__/SearchBar.test.ts](/Users/jrmag/my-recipe-app/src/components/__tests__/SearchBar.test.ts)
- 新規 `useSearchInputController` test

追加内容:

1. composition 中は parent commit しない
2. composition 中は URL sync 用 callback を呼ばない
3. compositionend 後に final value のみ commit
4. parent value が変わっても draft を不正上書きしない

### Search Model Unit

対象:

- [src/utils/__tests__/recipeSearchModel.test.ts](/Users/jrmag/my-recipe-app/src/utils/__tests__/recipeSearchModel.test.ts)

追加内容:

1. query 変更だけでは base score 再構築を要求しない構造へ寄せる
2. facet counts が query / facet 条件下でも安定することを確認

### Component / Layout

対象:

- 新規 `CategoryTags` or `RecipeList` layout test

追加内容:

1. カテゴリ群が wrap/grid されること
2. `最近見たレシピ` セクションが出ないこと

### Playwright Smoke

対象:

- [tests/smoke/navigation.spec.ts](/Users/jrmag/my-recipe-app/tests/smoke/navigation.spec.ts)

追加内容:

1. 日本語入力の再現ケース
   - `てばもと`
   - `ぴーまん`
2. 入力値が壊れず、そのまま保持されること
3. 合成中に URL が更新されないこと
4. カテゴリボタンが viewport 内に全て表示されること
5. `最近見たレシピ` が存在しないこと

### Optional Manual QA Matrix

手動確認対象:

- iOS Safari + 日本語キーボード
- Android Chrome + Gboard

## 7. Acceptance Criteria

### Quantitative

- `tests/smoke/navigation.spec.ts` に IME とカテゴリ表示のケースを追加
- `SearchBar` / `useSearchInputController` に IME regression test を追加
- `最近見たレシピ` は DOM から消える

### Qualitative

- `カテゴリ` が横スクロールなしで全部見える
- `てばもと` の入力中に固まった感覚が大きく減る
- IME の変換候補が壊れない

## 8. Implementation Order

1. Phase 1: `最近見たレシピ` 削除 + カテゴリ grid 化
2. Phase 2: IME-safe input hook / SearchBar 改修
3. Phase 3: 検索モデル分離で入力中負荷を削減
4. Phase 4: URL sync ポリシー変更
5. Phase 5: テスト追加と visual / smoke 更新

## 9. One Open Question

テスト行列を詰めるため、再現端末が

- Android Chrome + Gboard
- iPhone Safari
- それ以外

のどれかだけ分かると、priority をさらに絞れます。  
ただし、実装自体はこの情報がなくても着手可能です。

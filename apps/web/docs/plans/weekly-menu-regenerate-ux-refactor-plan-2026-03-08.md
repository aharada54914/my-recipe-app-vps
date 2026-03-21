# Weekly Menu Regenerate UX Refactor Plan

Date: 2026-03-08
Status: Draft

## Summary

`再生成` を押しても週間献立がほとんど変わらない主因は、現在の再生成が「別案を出す処理」ではなく、同じ入力に対して同じ最適解を再計算する処理になっているためです。

現状の selector は deterministic な beam search で、差分保証や再生成専用の novelty 目標を持っていません。しかも、ユーザーが「変わるはず」と解釈しやすい設定値の一部が選定ロジックに未接続です。

## Root Cause

### 1. 再生成ボタンが通常生成と同じ selector をそのまま再実行している

- `handleGenerate()` は `selectWeeklyMenu()` を再度呼ぶだけで、再生成専用の mode や target diff を渡していない
- lock 以外の既存献立を「何日以上変えるべきか」という要件が存在しない

References:

- `/Users/jrmag/my-recipe-app/src/hooks/useWeeklyMenuController.ts:148`
- `/Users/jrmag/my-recipe-app/src/hooks/useWeeklyMenuController.ts:151`

### 2. selector が強く deterministic で、同条件だと同じ解に収束しやすい

- `scoredMains` は base score 順に並ぶ
- 各日 `top 8` 候補だけを残し、beam も `top 5` だけを残す
- final selection は常に `beamStates[0]`
- candidate tie-break は `recipe.id` 昇順で、同点時も同じ候補が選ばれやすい

References:

- `/Users/jrmag/my-recipe-app/src/utils/weeklyMenuSelector.ts:228`
- `/Users/jrmag/my-recipe-app/src/utils/weeklyMenuSelector.ts:405`
- `/Users/jrmag/my-recipe-app/src/utils/weeklyMenuSelector.ts:492`
- `/Users/jrmag/my-recipe-app/src/utils/weeklyMenuSelector.ts:520`
- `/Users/jrmag/my-recipe-app/src/utils/weeklyMenuSelector.ts:551`
- `/Users/jrmag/my-recipe-app/src/utils/weeklyMenuSelector.ts:558`

### 3. 前回献立への penalty が弱く、しかも coarse

- recent menu penalty は `-20` 固定
- penalty は recipe 単位の base score に一括で乗るだけで、day-level difference を保証しない
- 「今の週と同じ recipe を 0 個に近づける」「最低 2 日は変える」といった制約がない

References:

- `/Users/jrmag/my-recipe-app/src/utils/weeklyMenuSelector.ts:190`
- `/Users/jrmag/my-recipe-app/src/utils/weeklyMenuSelector.ts:199`

### 4. ユーザーが差分源だと思う設定値が、実際は selector に効いていない

- `MenuSelectionConfig` に `userPrompt`, `desiredMealHour`, `desiredMealMinute` がある
- しかし `weeklyMenuSelector.ts` 内ではそれらを参照していない
- ユーザーから見ると「要望を入れて再生成したのに変わらない」構造になっている

References:

- `/Users/jrmag/my-recipe-app/src/utils/weeklyMenuSelector.ts:32`
- `/Users/jrmag/my-recipe-app/src/utils/weeklyMenuSelector.ts:468`

### 5. Gemini の refine path が存在するのに、再生成フローに接続されていない

- Gemini で「既存の7日献立を改善する」ユーティリティはある
- ただし `handleGenerate()` からは使われていない
- そのため AI 中核機能のはずなのに、再生成 UX は offline deterministic selector のまま

References:

- `/Users/jrmag/my-recipe-app/src/utils/geminiWeeklyMenu.ts:42`
- `/Users/jrmag/my-recipe-app/src/utils/geminiWeeklyMenu.ts:46`
- `/Users/jrmag/my-recipe-app/src/hooks/useWeeklyMenuController.ts:148`

## UX Problems

### A. ボタンラベルと実挙動が一致していない

`再生成` は普通、「別案を出す」「前回と違うものにする」と解釈されやすいです。実際の挙動は `recompute current optimum` に近く、期待を裏切ります。

### B. 差分が見えない

たとえ 1 品だけ変わっていても、UI 上で差分表示がないため「変わっていない」と感じやすいです。

### C. 再生成の変化量が保証されていない

今は再生成しても、unlock 日のうち何日変わるべきかが仕様として存在しません。そのため UX が「運任せ」になっています。

## Refactor Goals

1. `再生成` の結果がユーザー期待と一致するようにする
2. lock を守りつつ、unlock 対象では `最低 4 日、もしくは unlock 日の 60%` の変更を保証する
3. `再生成` という文言はそのまま維持する
4. seeded random を使って、毎回同じ top-1 に収束しないようにする
5. AI が有効なら再生成体験に反映する
6. 差分を UI で明示し、変わったことが分かるようにする
7. 再発防止として deterministic regression と UX regression をテストで固定する

## Proposed Design

### Phase 1: Single Regenerate Semantics

`handleGenerate()` は 2 モードだけを持つ。

- `初回生成`
- `再生成`

新規 config:

- `generationMode: 'initial' | 'regenerate'`
- `minimumChangedUnlockedDays: number`
- `excludeCurrentWeekRecipeIdsWeight: number`
- `preferNovelArrangement: boolean`
- `regenerateSeed: number`

方針:

- 初回生成: 現行ロジックを基準に維持
- 再生成: unlock 日の main が `max(4, ceil(unlockedDays * 0.6))` 以上変わることを保証する

補足:

- unlock 日が 4 未満なら、unlock 範囲で変えられるだけ変える
- `再生成` は「別案を出す」強い動作にするが、文言は変更しない

## Phase 2: Selector Refactor for Novelty Budget

selector を「単純な最高得点探索」から「品質 + 差分量」の多目的最適化へ変える。

新規シグナル:

- `changedUnlockedDays`
- `reusedCurrentWeekRecipeCount`
- `positionReusePenalty`
- `adjacentReusePenalty`

新規入力:

- `currentWeekItems?: WeeklyMenuItem[]`

score への追加:

- unlock 日で前回と同じ main を選ぶと penalty
- 同じ recipe を別日へスライドしただけでも軽い penalty
- minimum change を満たさない beam state は final candidate から除外
- minimum change を満たした candidate 群の中からだけ最終選択を行う

重要:

- `lockedItems` と `currentWeekItems` を分離する
- いまは `menu?.items` をそのまま渡しているため、lock 情報と diff 基準が同じ配列に混ざっている

## Phase 3: Controlled Non-Determinism

同点近傍の候補だけは deterministic top-1 固定をやめる。

方針:

- top candidate 群のうち `score delta <= threshold` の候補を candidate pool 化
- `weekStart + currentMenuHash + regenerateCount` ベースの seeded random で 1 つ選ぶ
- screenshot test や CI では固定 seed を使う

これにより、

- ユーザー操作では毎回少し違う
- CI / visual では再現可能

を両立する。

## Phase 4: Reconnect Personalization Signals

未接続の設定値を整理する。

- `userPrompt`
  - Gemini 有効時は refine prompt に必ず反映
  - offline selector でも keyword-based preferences を軽量に反映する
- `desiredMealHour`, `desiredMealMinute`
  - selector 本体には不要なら config から外す
  - カレンダー登録専用の値として責務を分離する

これで「設定したのに変わらない」誤解を減らす。

## Phase 5: Gemini-Aware Regenerate

Gemini が使える場合は 2 段構成にする。

1. local selector で baseline menu を作る
2. Gemini refine で swap proposal を返す

UX:

- 主ボタンは `再生成` のまま
- Gemini が無効な場合は local path のみ
- Gemini が有効でも、まず local selector で差分保証を満たしてから refine する
- refine 結果は `5日分を変更しました` のように差分を表示

## Phase 6: UI Changes

再生成 UI を以下に整理する。

- button label:
  - `再生成` のまま維持
- result toast:
  - `5日分を変更しました`
  - `固定した2日を除いて再生成しました`
- summary:
  - `変更 5 / 7日`
- day card diff chip:
  - `変更`
  - `固定`
  - 必要なら `維持`

## Test Plan

### Unit

1. `regenerate` で unlock 日が `max(4, ceil(unlockedDays * 0.6))` 以上変わる
2. minimum change 未達 state が採用されない
3. lock 日は絶対に変わらない
4. 同点候補で seeded random により stable だが seed を変えると結果が変わる
5. `desiredMealHour/minute` が selector から分離されたら、selector test から削除する

### Integration

1. 既存 menu を与えて再提案したとき、差分数が response に含まれる
2. Gemini refine 有効時、swap が少なくとも 1 件反映されるケースを fixture で確認
3. Gemini failure 時でも local refresh へ安全に fallback する

### Smoke

1. `再生成` で featured day を含む unlock 日の必要差分が満たされる
2. 2 日 lock した状態で `再生成` を押しても lock 日は維持される
3. toast / summary に変更日数が表示される
4. Gemini 未設定時でも `再生成` が local path で安定動作する

### Visual / UX

1. diff chip がモバイル viewport で崩れない
2. 再生成後 summary card に `変更日数` が表示される
3. 変更 chip が viewport 内で崩れない

## Priority

### P0

- `currentWeekItems` と `lockedItems` の分離
- minimum changed days を selector に追加
- seeded random の導入
- smoke test で `max(4, ceil(unlockedDays * 0.6))` を固定

### P1

- diff chip / change summary
- `desiredMealHour/minute` の責務分離

### P2

- Gemini-aware regenerate
- offline keyword preference の反映
- candidate explanation の表示

## Recommended First PR

### PR-1: Regenerate Baseline Fix

対象:

- `src/hooks/useWeeklyMenuController.ts`
- `src/utils/weeklyMenuSelector.ts`
- `src/utils/__tests__/weeklyMenuSelector.test.ts`
- `tests/smoke/weekly-menu-core.spec.ts`

内容:

- `generationMode` と `currentWeekItems` を追加
- `regenerate` で unlock main が `max(4, ceil(unlockedDays * 0.6))` 以上変わるようにする
- seeded random を candidate pool に導入する
- ボタン文言は `再生成` のまま維持する
- toast と summary に変更日数を出す

受け入れ条件:

- lock なしの週で再生成時、main recipe が `max(4, ceil(unlockedDays * 0.6))` 以上変わる
- lock ありでも locked days は不変
- GitHub smoke で安定する

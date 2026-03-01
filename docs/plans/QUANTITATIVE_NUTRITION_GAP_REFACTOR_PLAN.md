# 定量ギャップ表示（たんぱく質・食物繊維）リファクタリング計画

## 背景
現状の週次栄養評価は `gaps: string[]` で「低めです / 不足気味です」という定性メッセージ中心で、
ユーザーが「あと何g足りないか」を判断しづらい。

## 現状整理（as-is）
- `analyzeWeeklyMenuNutrition` は平均値を算出しているが、ギャップは文字列のみで返却している。
- しきい値は実装上固定（例: たんぱく質 16g/食、食物繊維 4g/食）。
- UI は `gaps` をそのまま列挙しているため、数値を表示するための型が不足している。

## 目標（to-be）
- たんぱく質・食物繊維について、**目標値 / 現状値 / 不足量(g)** を表示する。
- 週次の理解を優先し、最低限以下の2軸を同時に返す。
  - 1食平均の不足量（例: 平均で 2.3g 不足）
  - 1週間合計の不足量（例: 7日で合計 16.1g 不足）
- 定性メッセージは残しつつ、定量データを主情報に昇格する。

## 設計方針

### 1. 返却型の拡張
`WeeklyMenuNutritionInsights` に以下を追加する。

```ts
interface NutrientGap {
  nutrient: 'protein' | 'fiber'
  unit: 'g'
  targetPerMeal: number
  averagePerMeal?: number
  missingPerMeal?: number
  missingPerWeek?: number
  coverageRatio?: number
  dataCount: number
  requiredTier: 'nutrition-5' | 'nutrition-7'
}
```

- `missingPerMeal = max(0, targetPerMeal - averagePerMeal)`
- `missingPerWeek = missingPerMeal * 7`（まずは7日固定、将来はメニュー日数対応）
- 栄養データ不足時は `averagePerMeal` を `undefined` にし、`dataCount` と併記する。

### 2. 計算ロジックの分離
`src/utils/weeklyMenuNutritionInsights.ts` から定量計算を分離し、
`src/utils/nutritionGapCalculator.ts`（新規）で pure function 化する。

候補関数:
- `calculateNutrientGap(values: number[], targetPerMeal: number, days: number): NutrientGapCore`
- `buildWeeklyNutrientGaps(recipes, tierDecision): NutrientGap[]`

狙い:
- しきい値変更（例: 年齢/活動量別）を関数引数化しやすくする。
- テストを UI 非依存で高速化する。

### 3. 表示ロジックの刷新
`WeeklyMenuPage` で `gaps` 文字列だけでなく、`nutrientGaps` をカード表示する。

表示例:
- たんぱく質: 目標 16.0g / 現状 13.4g / 不足 2.6g/食（週 18.2g）
- 食物繊維: 目標 4.0g / 現状 3.1g / 不足 0.9g/食（週 6.3g）

データ不足時:
- 「測定可能レシピ 4/7件。現時点の不足量は参考値です。」を併記。

### 4. 互換性維持
- 既存の `gaps` / `highlights` は当面維持し、段階移行する。
- 既存 UI 依存箇所の破壊変更を避けるため、`nutrientGaps` は optional ではなく常に配列で返す。

## 実装ステップ

### Phase 1: 型・計算の導入（非破壊）
1. `NutrientGap` 型を追加。
2. たんぱく質・食物繊維の定量ギャップ算出を追加。
3. 既存テスト更新 + 新規ユニットテスト追加。

完了条件:
- 既存文言テストを壊さず、`missingPerMeal` / `missingPerWeek` の検証テストが通る。

### Phase 2: UI 表示切り替え
1. `WeeklyMenuPage` に定量ギャップ行を追加。
2. 丸め規則（小数1桁）を共通化。
3. データ不足時の注意文を追加。

完了条件:
- 画面上で「何g不足か」が一目で確認できる。

### Phase 3: しきい値設定の外出し
1. しきい値を定数化（将来はユーザー設定へ）。
2. `nutrition-5` / `nutrition-7` の適用条件を明文化。
3. 関連ドキュメント更新。

完了条件:
- しきい値変更が1箇所で可能。

## テスト計画
- ユニットテスト:
  - 平均13g（目標16g）→ 不足3g/食、21g/週
  - 平均が目標以上 → 不足0
  - データ件数不足時の `dataCount` と `coverageRatio`
- 統合テスト（既存 `weeklyMenuNutritionInsights.test.ts` 拡張）:
  - tier が `nutrition-5` のとき、たんぱく質ギャップを返す
  - tier が `nutrition-7` のとき、食物繊維ギャップを返す

## リスクと対策
- リスク: 目標値の妥当性への議論が発生する。
  - 対策: 初期値は現行実装しきい値を踏襲し、将来的に設定化。
- リスク: 栄養データ不足で誤読される。
  - 対策: `dataCount` と coverage を常時表示する。

## 成果物定義
- `analyzeWeeklyMenuNutrition` が、定性メッセージに加えて定量ギャップ配列を返す。
- 週次献立画面で、たんぱく質・食物繊維の不足量（g）が表示される。
- 上記を保証するテストが追加される。

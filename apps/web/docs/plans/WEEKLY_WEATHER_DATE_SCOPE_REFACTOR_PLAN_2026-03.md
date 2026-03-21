# 週間天気の日付スコープ保証リファクタリング計画（2026-03）

## 1. 背景
- 週間天気表示と献立スコアリングが別経路で天気データを参照しているため、週切替直後の状態や再生成タイミングによっては、対象週と異なる日付の予報を参照する懸念がある。
- 「該当する日付以外には表示しない」要件を明確にコードへ落とし込む必要がある。

## 2. 目的
1. 週間天気の表示対象を `weekStart` から 7 日間に厳密限定する。  
2. 献立再生成時に、対象週外の preloaded forecast を使わない。  
3. 日付スコープ判定を共通ユーティリティ化し、UI/選定ロジックで一貫利用する。

## 3. 対象範囲
- `src/utils/season-weather/weekWeather.ts`（新規）
- `src/pages/WeeklyMenuPage.tsx`
- `src/utils/weeklyMenuSelector.ts`
- `src/utils/__tests__/weekWeather.test.ts`（新規）
- `src/utils/__tests__/weeklyMenuSelector.test.ts`

## 4. 実装方針
### 4.1 日付スコープ共通化
- `getWeekDateStrings(weekStart)` で対象週の日付配列を生成。
- `filterForecastForWeek(forecast, weekStart)` で対象週外のデータを除外。
- `isCompleteForecastForWeek(forecast, weekStart)` で 7 日分の網羅性を判定。

### 4.2 UI（WeeklyMenuPage）
- 気象取得後に `filterForecastForWeek` を適用して state 格納。
- 再生成時の `preloadedWeather` は `isCompleteForecastForWeek === true` のときのみ選定ロジックへ渡す。

### 4.3 選定ロジック（weeklyMenuSelector）
- `preloadedWeather` を受け取った場合でも、まず対象週にフィルタ。
- 7 日分が揃っていなければ `getWeeklyWeatherForecast(weekStartDate)` を実行して補完。

## 5. テスト計画
1. ユーティリティ単体テスト
   - 対象週7日生成
   - 対象週外データの除外
   - 7日網羅性判定
2. 選定ロジックテスト
   - 対象週の preloaded なら追加 fetch しない
   - 別週 preloaded なら追加 fetch する

## 6. 受け入れ基準（DoD）
- 週間天気カードに表示される日付が常に `weekStart ~ weekStart+6` に限定される。
- 再生成時に対象週外の天気データが選定スコアに使われない。
- 追加テストが green。

# 東京都基準 価格×気象適応 週間献立リファクタリング計画（実装反映版 / 2026-03）

## 0. 目的

`KN-HW24H` CSV・`AX-XA20` CSV・Gemini追加レシピを同一の週間献立エンジンで扱い、価格モードと季節/天気補正を同じ土台で運用する。

この計画では次を固定する。

- 価格モードは `節約 / 気にしない / 贅沢`
- 季節と天気は全モード共通で適用
- 推薦理由表示は簡易表示に留める
- 価格同期は起動/復帰時判定で 1 か月閾値

## 1. 実装済み事項

### 1.1 カテゴリ推定の強化
- `csvParser.ts` と `prebuild-recipes.mjs` で、`KN-HW24H` のカテゴリ推定をタイトル一致に加えて材料名も参照する方式へ変更済み。

### 1.2 Gemini低信頼レシピの下限重み
- `weeklyMenuSelector.ts` に `GEMINI_LOW_CONFIDENCE_WEIGHT_FLOOR = 0.2` を導入済み。
- `isUserAdded` かつ低信頼のレシピでも、重みが 20% 未満へ落ち切らないよう補正する。

### 1.3 気象キャッシュの基盤
- `weatherCache` と関連型を追加済み。
- 障害時は 2 日以内のキャッシュを再利用する方針で実装を進めている。

## 2. To-Be アーキテクチャ

### 2.1 スコア統合

```text
FinalScore = BaseScore + SeasonalScore + WeatherFit + ModeSpecificScore
```

- `SeasonalScore` と `WeatherFit` は全モード共通
- `ModeSpecificScore` だけ節約/気にしない/贅沢で切り替える

### 2.2 データ基盤
- `ingredientPrices`
- `ingredientPriceSyncLogs`
- `weatherCache`
- `recipeFeatureMatrix`
- `userPreferences` 拡張（mode, budget, last syncs, thermal preference）

## 3. 残タスク

### Phase 1: ETL と特徴量化
- CSV/Gemini の特徴量を同一基準で生成する
- `recipeFeatureMatrix` を週間献立の標準入力に寄せる

### Phase 2: 同期層
- 東京都価格同期を 1 か月閾値で起動/復帰時に実行する
- 天気取得失敗時は 2 日キャッシュへフォールバックする

### Phase 3: selector 統合
- `SeasonalScore + WeatherFit + ModeSpecificScore` を selector に統合する
- `ignore` では価格重みを無効化し、`luxury` はご褒美枠を可変にする

### Phase 4: UI
- 推薦理由の簡易表示
- 予算超過時の警告と再提案
- 設定画面で価格ソース/最終更新日の表示

## 4. テスト計画

### 単体
- `startupPriceSync.test.ts`
- `weatherScoring.test.ts`
- `recipeFeatureMatrix.test.ts`
- `seasonWeather.test.ts`
- `weatherCache.test.ts`

### 統合
- `weeklyMenuSelector.mode-weather-source.test.ts`
  - 全モードで季節/天気補正が有効
  - `ignore` で価格重みがゼロ
  - Gemini低信頼 20% 下限が維持される

### E2E 相当
- 起動時の価格同期
- 天気 API 障害時のキャッシュ継続
- 予算超過からの再提案フロー

## 5. DoD

1. CSV/Gemini 追加レシピが同一エンジンで扱える
2. `KN-HW24H` のカテゴリ推定がタイトル+材料で動く
3. Gemini低信頼重み下限 20% が適用される
4. 天気障害時に 2 日キャッシュで継続できる
5. 価格モードごとの差分が selector に反映される
6. 推薦理由が簡易表示される

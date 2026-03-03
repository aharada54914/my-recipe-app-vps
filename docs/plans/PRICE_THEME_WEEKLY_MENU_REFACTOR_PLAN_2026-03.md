# 東京都基準 価格テーマ対応 週間献立リファクタリング計画（再最終版 / 2026-03）

## 0. 目的と今回の改訂ポイント

### 目的
東京都基準の食材価格を活用しつつ、週間献立を **節約 / 気にしない / 贅沢** の3モードで最適化する。加えて、**季節・天気を全モード共通で考慮**し、日々の実用性を高める。

### 今回の改訂ポイント
1. 価格データ自動更新の判定間隔を **7日 -> 1か月** に変更。
2. 「季節・天気考慮」は価格モードに依存しない **共通必須要件** に変更。
3. 実行計画・スコアリング・DoD・テスト戦略を上記に合わせて再編。

---

## 1. 前提と実現方針

### 1.1 PWA制約を踏まえた更新方針
- PWAはOS制約上、常時バックグラウンドでの確実な定期実行は保証しづらい（特にiOS）。
- そのため、アプリ起動/フォアグラウンド復帰時に更新要否を判定する。

### 1.2 更新トリガ（改訂）
- トリガ: アプリ起動 / フォアグラウンド復帰時。
- 条件: `lastPriceSyncAt` から **1か月以上** 経過。
- 動作: 条件一致時にバックグラウンド同期を非同期実行（UI操作不要）。
- 失敗時: 前回確定価格を継続利用し、設定画面に失敗状態を表示。

---

## 2. モード仕様（価格テーマ）

## 2.1 節約モード
- 目的: 予算達成率とコスト効率を最大化。
- 特性: 価格ペナルティ強め、在庫活用強め、高単価連続抑制。

## 2.2 気にしないモード
- 目的: 価格要素を無効化し、既存ロジック重視で献立選定。
- 特性: 価格スコアを完全無効化。

## 2.3 贅沢モード
- 目的: 高コスト許容ではなく、1週間の体験価値最大化。
- 特性: 体験価値スコアを主軸に加点（予算超過時は警告+再提案）。

> 重要: **季節・天気考慮は全モード共通で適用**し、モード差は価格/体験価値重みのみで表現する。

---

## 3. 全モード共通要件: 季節・天気考慮

## 3.1 季節考慮（共通）
- 既存の旬食材ロジックを拡張し、季節一致度を全モードで加点。
- 春夏秋冬 + 月次補正で旬スコアを算出。

## 3.2 天気考慮（共通）
- 週間予報の代表値（日次）を取得し、献立選定に反映。
- 例:
  - 高温日: さっぱり系・加熱時間短めを加点
  - 低温日: 汁物・煮込み系を加点
  - 雨天日: 買い足し負担を下げる在庫活用を加点

## 3.3 WeatherComfortScore（提案）
```text
WeatherComfortScore =
  0.45 * ThermalFit
+ 0.30 * CookingLoadFit
+ 0.25 * ShoppingBurdenFit
```
- ThermalFit: 気温と料理タイプの適合
- CookingLoadFit: 体感負荷（蒸し暑さ等）と調理時間の適合
- ShoppingBurdenFit: 天候不良時の買い物点数抑制度

## 3.4 最終スコア統合イメージ
```text
FinalScore =
  BaseScore
+ SeasonalScore
+ WeatherComfortScore
+ ModeSpecificScore
```
- `ModeSpecificScore` のみ節約/気にしない/贅沢で差分。
- `SeasonalScore` と `WeatherComfortScore` は全モード共通。

---

## 4. 贅沢モードの体験価値定義（維持）

### 4.1 体験価値6軸
1. ご褒美感（Premium Ingredient）
2. 多様性（Variety）
3. 行事適合（Occasion Fit）
4. 調理満足（Cooking Delight）
5. 見栄え/共有価値（Presentation）
6. 栄養下限保証（Nutrition Floor Guard）

### 4.2 体験価値スコア式
```text
LuxuryExperienceScore =
  0.28 * PremiumIngredientScore
+ 0.20 * VarietyScore
+ 0.16 * OccasionFitScore
+ 0.14 * CookingDelightScore
+ 0.12 * PresentationScore
+ 0.10 * NutritionFloorGuard
```

### 4.3 配置ルール
- 週7日中2〜3日を「ご褒美枠」候補。
- ご褒美枠の連続は最大2日。
- 平日は負荷を抑え、週末へ体験価値を寄せる。

---

## 5. 価格データ仕様

## 5.1 データソース（東京都基準）
優先候補:
1. 総務省統計局 小売物価統計調査（東京都区部）
2. 農林水産省系 公的価格データ（補完）
3. 東京都中央卸売市場 統計（生鮮補完）

統合ルール:
- 優先ソース > 更新日時 > 外れ値除外中央値
- `sourceUrl`, `fetchedAt`, `confidence` を保持

## 5.2 欠損フォールバック
1. 完全一致
2. 同義語（例: 鶏腿肉 -> 鶏もも肉）
3. 類似食材（しきい値提案: 0.82）
4. 東京都カテゴリ中央値
5. 既定値

## 5.3 調味料除外
- `sub`カテゴリは価格計算・予算判定から除外。
- 買い物リストには表示するが価格小計には含めない。

---

## 6. UI/UX要件

### 6.1 設定画面
- モード選択: 節約 / 気にしない / 贅沢
- 週予算入力
- 価格基準（東京都）明示
- 最終価格更新日、同期ステータス表示
- データソース名 + URL表示
- 季節・天気考慮が全モード共通で有効である説明を表示

### 6.2 起動時自動更新表示
- 条件一致時（1か月超過）にトースト表示:
  - 開始: 価格データを更新中
  - 成功: 最新価格に更新しました
  - 失敗: 更新失敗（前回データで継続）

### 6.3 予算超過時
- 警告バナー + 2CTA:
  - このまま使う
  - 予算内で再提案
- 再提案時はロック日維持、非ロック日のみ再計算。

---

## 7. アーキテクチャ/実装方針

### 7.1 新規モジュール
- `src/lib/priceSources.ts`
- `src/utils/cost/priceSync.ts`
- `src/utils/cost/startupPriceSync.ts`
- `src/utils/cost/priceResolver.ts`
- `src/utils/cost/similarIngredientResolver.ts`
- `src/utils/cost/costEstimator.ts`
- `src/utils/cost/luxuryExperience.ts`
- `src/utils/season-weather/weatherProvider.ts`（新規）
- `src/utils/season-weather/weatherScoring.ts`（新規）
- `src/utils/cost/weeklyCostSummary.ts`

### 7.2 既存改修対象
- `src/utils/weeklyMenuSelector.ts`（最終スコア統合）
- `src/utils/weeklyShoppingUtils.ts`（調味料除外価格集計）
- `src/components/MealPlanSettings.tsx`
- `src/pages/WeeklyMenuPage.tsx`
- `src/contexts/PreferencesContext.tsx`（起動時同期起点）

### 7.3 DB拡張
- `ingredientPrices`
- `ingredientPriceSyncLogs`
- `ingredientSimilarityCache`
- `weatherCache`（新規・日次予報キャッシュ）
- `userPreferences` 追加:
  - `weeklyMenuCostMode: 'saving' | 'ignore' | 'luxury'`
  - `weeklyBudgetYen?: number`
  - `lastPriceSyncAt?: Date`
  - `lastWeatherSyncAt?: Date`

---

## 8. 実行計画（立て直し）

### Phase 0: 仕様凍結
- 更新閾値を1か月で固定。
- 季節・天気共通適用の重みを確定。
- 贅沢体験価値6軸重みを確定。

### Phase 1: データ基盤
- Dexie schema拡張（価格・類似・天気キャッシュ）。
- 価格データ取得器/ログ。

### Phase 2: 起動時自動更新
- `startupPriceSync` 実装。
- 1か月超過時のみ価格同期。
- 同期結果UI反映。

### Phase 3: 季節・天気統合（全モード共通）
- `weatherProvider` と `weatherScoring` 実装。
- `weeklyMenuSelector` に `SeasonalScore + WeatherComfortScore` を統合。

### Phase 4: 価格モード統合
- モード分岐（saving/ignore/luxury）。
- 贅沢体験価値スコア導入。
- 予算超過警告・再提案。

### Phase 5: 検証・段階公開
- 単体/統合/E2E相当テスト。
- Feature flagで段階公開。

---

## 9. テスト戦略（改訂）

### 単体
- `startupPriceSync.test.ts`: 1か月閾値判定
- `weatherScoring.test.ts`: 気温/降雨に応じた加点ロジック
- `luxuryExperience.test.ts`: 6軸スコア合成
- `priceResolver.test.ts`: 同義語/類似/カテゴリ fallback
- `costEstimator.test.ts`: 調味料除外

### 統合
- `weeklyMenuSelector.mode-weather.test.ts`
  - 全モードで季節・天気スコアが適用される
  - ignoreで価格重みゼロ
  - saving < luxury（週額傾向）

### E2E相当
- 起動時、1か月超過で価格同期が走る
- 設定画面でソースURL/最終更新日表示
- 天気条件変更で献立傾向が変化
- 予算超過 -> 再提案フロー

---

## 10. 受け入れ基準（DoD）
1. 起動時に最終価格更新から1か月以上で自動同期が実行される。
2. 季節・天気考慮が全モードで有効。
3. 気にしないモードでは価格ロジックを適用しない。
4. 贅沢モードで体験価値スコアが計算される。
5. 調味料が価格計算から除外される。
6. 予算超過時に警告 + 再提案導線が機能する。
7. 設定画面でソースURLと最終更新日を確認できる。

---

## 11. インタビュー項目（最終確認）
1. 1か月判定は「30日超過」か「同日翌月到達」か。
2. 天気APIの優先候補（無料枠・利用規約）をどれにするか。
3. 天気データ欠損時は直近キャッシュを何日まで許容するか。
4. 贅沢ご褒美枠（2〜3日）を固定か設定可能にするか。
5. 類似度しきい値0.82を採用するか。

> 上記を確定後、実装フェーズへ移行する。

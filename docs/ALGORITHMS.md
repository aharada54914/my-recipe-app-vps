# アルゴリズム仕様一覧

最終改訂: 2026-03-05
対象コードベース: `claude/nifty-black` (v2.0.0)

本ドキュメントは、Kitchen App の「判定・推定・選択・通知」ロジックをまとめた仕様書です。

---

## 1. 週間献立選択

対象: `src/utils/weeklyMenuSelector.ts`

### 主菜選択 `selectWeeklyMenu`

- 候補: 最大200件をランダムオフセット抽出
- 除外: ヘルシオデリ判定
- スコア要素:
  - 在庫一致率 `*3.0`
  - 旬食材ボーナス（季節優先度で重み）
  - 直近献立使用ペナルティ
  - 直近閲覧ペナルティ
- 多様性補正:
  - カテゴリ重複抑制
  - 機器偏り抑制
  - 機器交互ボーナス

### 副菜/スープ補完

- 主菜選定後に2nd passで選択
- ジャンル整合・重さバランス・偏り抑制を適用

---

## 2. 旬食材ローテーション（v1.5.0）

対象: `src/data/seasonalIngredients.ts`

- 月ごとに24種類の旬食材プールを保持（1月〜12月すべて定義）
- `getCurrentSeasonalIngredients(limit = 10)` でデフォルト10件を選抜
- 日付（年内通算日）をシードに毎日開始位置をずらして選抜（`rotateAndPick`）
- 同じ月でも日替わりで提案食材が変化（最大24通りのパターン）

---

## 3. 在庫一致率

対象: `src/utils/recipeUtils.ts`

- `calculateMatchRate(ingredients, stockNames)`
- 在庫管理UIでは調味料プリセットの一括登録に対応（在庫一致率計算には従来通り含める）
- 食材名を正規化（表記ゆれ吸収）
- `一致数 / 総数 * 100` を四捨五入

---

## 4. スケジュール計算

対象: `src/utils/recipeUtils.ts`

- `calculateSchedule`: 完成時刻から逆算
- `calculateAutoSchedule`: 下ごしらえ→機器調理→盛り付けを自動生成
- `calculateMultiRecipeSchedule`: 機器競合を反復解消（最大10回）

---

## 5. 買い物リスト生成

対象:
- `src/utils/weeklyShoppingUtils.ts`
- `src/components/EditableShoppingList.tsx`

- `aggregateIngredients`: `name+unit` で集約
- `適量` は重複抑制のみ
- 不足判定: `inStock=false`
- v1.5.0 UIロジック:
  - 初期表示は主材料優先（調味料はトグル）
  - 不足項目の追加/編集/削除
  - コピーは未チェック項目のみ

---

## 6. 検索アルゴリズム

対象: `src/utils/searchUtils.ts`
補助: `src/utils/preferenceSignals.ts`, `src/utils/preferenceRanker.ts`

- Fuse.js の重み付き検索
  - title: 2
  - ingredients.name: 1
- 同義語展開後に結果マージ
- 最良スコアで重複排除
- Kitchen App Preference Rank (KAPR):
  - `QueryScore`（検索一致）
  - `PreferenceScore`（閲覧履歴/お気に入り/週間献立採用/カレンダーmeal）
  - `StockScore`（在庫一致率）
  を合成して最終並び順を決定

---

## 7. AI解析アルゴリズム

対象:
- `src/utils/geminiParser.ts`
- `src/utils/geminiWeeklyMenu.ts`
- `src/utils/imagePreprocess.ts`
- `src/utils/geminiIngredientExtractor.ts`
- `src/utils/geminiMenuGenerator.ts`
- `src/utils/recipeDraftNormalizer.ts`

- URL/テキストからJSON構造を抽出
- 型検証・補完でレシピデータ化
- 週間献立は任意でGeminiリファイン（失敗時フォールバック）
- 在庫提案は2段階:
  - ① 複数画像を縮小・コラージュ化して食材文字リスト抽出
  - ② 食材文字リストからDB互換の献立JSON生成
- 機能別モデル選択:
  - 質問/テキスト解析は軽量モデルを初期値
  - 画像解析/在庫提案は標準モデルを初期値
- URL解析/画像解析は設定により上位モデルへ自動再試行可能
- AI使用量はアプリ内で日次推定カウント（モデル別/機能別）
- 保存前にレシピドラフトを正規化し、材料/手順の必須項目・人数互換を検証

---

## 8. バックアップ/復元マージ

対象: `src/lib/googleDrive.ts`

- 保存先: Google Drive `appDataFolder`
- 対象はユーザーデータ中心（recipes を含まない）
- APIレスポンスは全てHTTPステータス検証
- 復元時はテーブルごとに重複回避マージ

## 8.1 Geminiチャット状態保持（v1.9.6）

対象: `src/stores/geminiStore.ts`

- 送信処理は Zustand ストアで実行（タブ移動後も継続）
- 履歴は `localStorage` に保存し、約3日より古いメッセージを自動削除
- 入力途中の下書きも保存

---

## 9. 通知アルゴリズム（v1.5.0）

対象:
- `src/components/NotificationScheduler.tsx`
- `src/utils/notifications.ts`
- `src/pages/WeeklyMenuPage.tsx`

- 通知権限が `granted` のときのみ発火
- 調理開始通知:
  - 設定時刻に30秒間隔で一致判定
  - 日次キーで重複通知を防止
- 週間献立完了通知:
  - 献立生成完了時に発火
- 買い物通知:
  - 買い物リスト表示時、不足材料がある場合に発火

---

## 10. 週間献立共有（v1.5.0）

対象: `src/utils/weeklyMenuShare.ts`

- 共有データを `base64url(JSON)` へエンコード
- `?shared=` クエリまたはコード入力でデコード
- ペイロード検証後に週メニューへ適用

---

## 11. インポート/エクスポート

対象:
- `src/utils/dataImport.ts`
- `src/utils/dataExport.ts`

- `exportData`: IndexedDBデータをJSON出力
- `importData`:
  - `overwrite`: 全置換
  - `merge`: 主キーupsert

---

## 12. 天気快適スコア（v2.0.0）

対象: `src/utils/season-weather/weatherScoring.ts`

今日の天気とレシピの相性を 0〜1 のスコアで評価。「今日食べたい料理」セクションのレシピ選定に使用する。

```
weatherComfortScore = 0.45 × thermalFit(recipe, weather)
                    + 0.30 × cookingLoadFit(recipe, weather)
                    + 0.25 × shoppingBurdenFit(recipe, weather)
```

### thermalFit（気温適合度）重み 45%

| 条件 | スコア |
|---|---|
| maxTempC ≥ 28 かつ タイトルに `冷\|サラダ\|さっぱり` を含む | 1.0 |
| maxTempC ≥ 28 かつ タイトルに `煮込み\|鍋` を含む | 0.3 |
| maxTempC ≥ 28 その他 | 0.6 |
| maxTempC ≤ 12 かつ タイトルに `煮込み\|鍋\|スープ` を含む | 1.0 |
| maxTempC ≤ 12 かつ タイトルに `冷\|サラダ` を含む | 0.4 |
| maxTempC ≤ 12 その他 / 12°C < maxTempC < 28°C | 0.7 |

### cookingLoadFit（調理負荷適合度）重み 30%

| 条件 | スコア |
|---|---|
| maxTempC ≥ 30 かつ totalTimeMinutes ≤ 20 | 1.0 |
| maxTempC ≥ 30 かつ totalTimeMinutes > 20 | 0.5 |
| maxTempC < 30 かつ totalTimeMinutes ≤ 40 | 0.8 |
| maxTempC < 30 かつ totalTimeMinutes > 40 | 0.6 |

`totalTimeMinutes` が null の場合は 30 分として扱う。

### shoppingBurdenFit（買い物負担適合度）重み 25%

| 条件 | スコア |
|---|---|
| precipitationMm < 5（晴れ/曇り） | 0.7（固定） |
| precipitationMm ≥ 5 かつ main食材数 ≤ 5 | 1.0 |
| precipitationMm ≥ 5 かつ main食材数 > 5 | 0.6 |

`main食材数` は `ingredients[].category === 'main'` の件数。調味料（`seasoning`）は除外。

**天気データ**: 気象庁 API (`https://www.jma.go.jp/bosai/forecast/data/forecast/130000.json`)、東京エリア。取得失敗時は月別平均気温に基づく合成7日間フォールバック（`buildSyntheticForecast`）を使用。

---

## 13. 今日食べたい料理スコア — Phase 3（v2.0.0）

対象: `src/pages/HomePage.tsx` — `findTodayRecipes`

Phase2ベクトルスコア・T_opt個人化スコア・旬食材スコアを合成し、ホームの「今日食べたい料理」2×2タイルに表示するレシピ4件を決定する（Softmax確率的サンプリング）。

```
todayScore = 0.40 × vecScore
           + 0.35 × personalWeatherScore
           + 0.25 × seasonalScore
```

| 成分 | 重み | 説明 |
|---|---|---|
| `vecScore` | 40% | Phase2: `dotProduct(weatherDemandVec, recipeWeatherVec)`（§14参照） |
| `personalWeatherScore` | 35% | Phase3: `computeWeatherComfortScoreWithTopt(recipe, weather, tOpt)`（§15参照） |
| `seasonalScore` | 25% | 食材のいずれかが当月の旬食材リストに含まれれば 1、なければ 0 |

- ヘルシオデリ判定（`isHelsioDeli()`）のレシピは除外
- 天気データ未取得時: 旬食材フィルタのみで上位4件にフォールバック
- 最終4件は `softmaxSample(scored, 4, temperature=0.4)` で確率的に選出（多様性と品質のバランス）
- 旬食材: `src/data/seasonalIngredients.ts` — 月ごとに24種類のプールを保持。`getCurrentSeasonalIngredients(limit=10)` が年内通算日をシードにローテーションして10件を選抜（§2参照）

---

## 14. Phase 2 レシピ×気象4Dベクトル（v2.0.0）

対象: `src/utils/season-weather/recipeWeatherVectors.ts`

レシピの材料・栄養・調理特性から4次元属性ベクトルを算出し、天気需要ベクトルとのドット積でスコアリングする。スコア識別率を Phase 1 の約35% から約50% へ向上。

### レシピベクトル `RecipeWeatherVec = [x_temp, x_water, x_spice, x_carb]`

| 次元 | 意味 | 高スコア例 | 低スコア例 |
|---|---|---|---|
| `x_temp` | 温料理強度 | 鍋・シチュー・煮込み（+調理時間長） | サラダ・冷製（-調理時間短） |
| `x_water` | 汁物・水分強度 | カテゴリ=スープ・みそ汁・ポタージュ | 炒め・揚げ物 |
| `x_spice` | 辛み強度 | キムチ・カレー・豆板醤・ラー油 | （辛み素材なし） |
| `x_carb` | 糖質密度 | `carbG / 50` で正規化 | 栄養未取得時は 0.5 |

### 天気需要ベクトル `WeatherDemandVec`

`computeWeatherDemandVec(weather, tOpt, dayOfYear)` が気温・降水量・T_opt・年内通算日から算出。年内通算日による `B_carb`（炭水化物季節補正: 冬高・夏低）を含む。

### スコア算出

```
vecScore = dot(weatherDemandVec, recipeWeatherVec)  // [0, 1]
```

---

## 15. T_opt 個人最適気温学習（v2.0.0）

対象: `src/utils/season-weather/tOptLearner.ts`

ユーザーの閲覧履歴・献立採用履歴から個人の熱的快適温度帯（T_opt）を推定する。デフォルトは 22°C。推定値は `UserPreferences.tOpt` として保存。

### 学習ロジック

- `viewHistory` と `weeklyMenus` の採用レシピのタイトルキーワードを集計
- 「鍋・シチュー・煮込み」系（温料理）採用が多い → T_opt を下方修正（寒い料理好き）
- 「サラダ・冷製・さっぱり」系（冷料理）採用が多い → T_opt を上方修正（さっぱり系好き）

### 個人化スコア

```
personalWeatherScore = computeWeatherComfortScoreWithTopt(recipe, weather, tOpt)
```

T_opt を基準に気温差に応じたペナルティを付与し、§12 の3因子スコアと合成する。

---

## 16. コスト推定（v2.0.0）

対象: `src/utils/cost/`

食材の平均価格データ（`ingredientAveragePrices.ts`）をもとにレシピのコストを推定する。

### モジュール構成

| ファイル | 役割 |
|---|---|
| `costEstimator.ts` | レシピ1件のコスト合計を計算するエントリポイント |
| `priceResolver.ts` | 食材名と単位から価格を解決（完全一致→類似一致の順） |
| `similarIngredientResolver.ts` | 食材名の表記ゆれを吸収し類似食材の価格を流用 |
| `luxuryExperience.ts` | 高額食材（松茸・カニ・和牛等）を検出しラグジュアリーフラグを付与 |
| `priceSync.ts` | 価格データの同期処理（将来的な外部API連携を想定） |
| `startupPriceSync.ts` | `initDb()` から呼び出す起動時価格同期 |

### 週間献立コストモード

`UserPreferences.weeklyMenuCostMode` により挙動を切り替え:
- `'ignore'`: コスト計算スキップ（デフォルト）
- `'budget'`: `weeklyBudgetYen` を週あたり上限として考慮
- `'luxury'`: 高額食材を優先

---

## 17. 週間献立 天気スコアリング統合（v2.0.0）

対象: `src/pages/WeeklyMenuPage.tsx`, `src/utils/weeklyMenuSelector.ts`

週間献立ページが気象庁APIから当週の天気予報を取得し、`selectWeeklyMenu` に渡すことで天気考慮の献立選択を実現する。

### フロー

1. `WeeklyMenuPage` 起動時・週切替時に `getWeeklyWeatherForecast(weekStart)` を呼び出し
2. `filterForecastForWeek(forecast, weekStart)` で当週7日分に絞り込み
3. `isCompleteForecastForWeek(weeklyWeather, weekStart)` が真のとき `preloadedWeather` として `selectWeeklyMenu` に渡す
4. `selectWeeklyMenu` 内部でレシピの天気スコアを加味してスコアリング

### 天気パネルUI

- 折りたたみ式（デフォルト折りたたみ）、展開時に7日分を表示
- 手動再取得ボタン（`refreshWeeklyWeather`）+ 最終取得日時表示
- 各日: `WeatherIllustration` + 最高/最低気温 + 降水目安

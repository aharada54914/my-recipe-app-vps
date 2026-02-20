# アルゴリズム仕様一覧

最終更新: 2026-02-20  
対象コードベース: `main` (v1.0.0)

このドキュメントは、アプリ内で「入力に対して規則/重み/推定で結果を決める」処理をアルゴリズムとして整理したものです。  
単純な CRUD ラッパーは除外し、選択・スコアリング・推定・競合解決・同期方針を中心に記載します。

---

## 1. 献立自動選択アルゴリズム（主菜 + 副菜/スープ）

対象: `/Users/jrmag/my-recipe-app/src/utils/weeklyMenuSelector.ts`

### 1-1. 週次献立選択 `selectWeeklyMenu`
- 目的: 7日分の主菜を自動選択し、各日に副菜またはスープを1品補完する。
- 入力:
  - `weekStartDate`
  - `config` (`seasonalPriority`, `userPrompt`, `desiredMealHour`, `desiredMealMinute`)
  - `lockedItems`（固定日）
- 出力: `WeeklyMenuItem[]`（7日）

主菜選択フロー:
1. レシピ母集団: `recipes` から最大200件をランダムオフセットで抽出（固定先頭偏りを回避）。
2. 除外: ヘルシオデリ判定 (`isHelsioDeli`) されたレシピを除外。
3. ベーススコア計算:
   - 在庫一致率 `matchRate * 3.0`
   - 旬食材ボーナス `10 * seasonalWeight`（`low=0.5`, `medium=1.5`, `high=3.0`）
   - 直近2週献立で使用済みなら `-20`
   - 直近30件閲覧済みなら `-5`
4. 日別貪欲選択（Greedy）:
   - `locked` 日は固定値を採用。
   - 未固定日は最高スコア候補を1件採用。
   - 多様性補正:
     - 同カテゴリが3回目以降で減点（`(catCount - 1) * 10`）
     - 同デバイスが4回目以降で減点（`(devCount - 2) * 5`）
     - 直前日と異なるデバイスなら `+3`

### 1-2. 副菜/スープ選択（2nd pass）
- 対象候補: `category === '副菜' || 'スープ'`
- ベーススコア: 主菜と同等（在庫・旬・最近利用ペナルティ）
- 日別補正:
  - 同サブカテゴリ偏重抑制（3件超で減点）
  - 主菜とジャンル一致で `+15`
  - 重さバランス:
    - 主菜重 + 副菜軽 `+10`
    - 主菜軽 + 副菜重 `+5`
    - 主菜重 + 副菜重 `-10`
- 既使用副菜 ID は再利用しない。

### 1-3. 補助ヒューリスティクス
- `guessGenre`: タイトル + 食材キーワードから `japanese/western/chinese/other` を推定。
- `isHeavy`: 肉・揚げ物・脂質系キーワードで重い料理を判定。
- `getAlternativeRecipes`: 使用済みID除外後、在庫一致率降順で代替候補上位N件を返却。

---

## 2. 在庫一致率・工程スケジュール・分量計算

対象: `/Users/jrmag/my-recipe-app/src/utils/recipeUtils.ts`

### 2-1. 在庫一致率 `calculateMatchRate`
- 目的: レシピ食材のうち在庫がある割合を百分率化。
- 仕様:
  - 食材名は `resolveIngredientName` で表記ゆれ正規化。
  - `matched / ingredients.length * 100` を四捨五入。

### 2-2. 単一レシピ逆算スケジュール `calculateSchedule`
- 目的: 目標完成時刻から逆算して工程開始時刻を出す。
- 手順: ステップ配列を末尾から逆順にたどり `subMinutes` で積み上げ。

### 2-3. 複数レシピ同時進行 `calculateMultiRecipeSchedule`
- 目的: 複数レシピを同目標時刻に間に合わせつつ、機器競合を解消。
- 制約: `hotcook` と `healsio` は同時に1台想定。
- 手順:
  1. 各レシピを通常逆算。
  2. 反復（最大10回）でデバイス工程の重なりを検出。
  3. 重なり分だけ該当レシピ全工程を前倒し（開始を早める）。
  4. シフト量を `conflicts` に記録。

### 2-4. 自動工程生成 `calculateAutoSchedule`
- 3工程固定: `下ごしらえ -> デバイス調理 -> 盛り付け`
- `calculatePrepTime`: `5 + (材料数-1)*2` 分
- `parseCookingTime`: `1時間10分` 形式を分に変換、欠損時はフォールバック
- 生成した工程を `calculateSchedule` へ渡す。

### 2-5. 分量/塩分関連
- `adjustIngredients`: 人数比率で分量を線形スケール。
- `formatQuantityVibe`: 単位別丸め（g/ml, 大さじ小さじ分数, 個数系の半/強/約）。
- `calculateSalt`: 重量と塩分濃度から塩/醤油/味噌量を換算。

---

## 3. 在庫ベース推薦アルゴリズム

対象: `/Users/jrmag/my-recipe-app/src/utils/geminiRecommender.ts`

- `getLocalRecommendations(limit=6)`
  - 最大200レシピを対象。
  - ヘルシオデリ除外。
  - 在庫一致率を計算し、0%は除外。
  - 一致率降順で上位 `limit` 件。

---

## 4. レシピ検索・関連語展開アルゴリズム

対象: `/Users/jrmag/my-recipe-app/src/utils/searchUtils.ts`

- `Fuse.js` の重み付き曖昧検索:
  - `title` 重み2
  - `ingredients.name` 重み1
  - `threshold=0.4`, `ignoreLocation=true`
- `expandSynonyms` で検索語を同義語展開。
- 各語の検索結果をレシピID単位でマージし、最良（最小）scoreを採用。
- 最終的に score 昇順で返却。

---

## 5. 買い物リスト集約アルゴリズム

対象:
- `/Users/jrmag/my-recipe-app/src/utils/weeklyShoppingUtils.ts`
- `/Users/jrmag/my-recipe-app/src/utils/shoppingUtils.ts`

### 5-1. 週次集約 `aggregateIngredients`
- キー: `name + unit`
- 同一キーは数量合算。
- `適量` は合算せず1件のみ保持。
- 在庫フラグを付与し、並び順は:
  1. 主材料 (`main`) 優先
  2. 欠品 (`inStock=false`) 優先

### 5-2. 欠品抽出
- `getMissingWeeklyIngredients`: 集約結果から `!inStock` のみ。
- `getMissingIngredients`: 単レシピ食材を在庫名集合で差分抽出。

### 5-3. テキスト整形
- `formatWeeklyShoppingList`: 主材料/調味料を分けて出力。
- `formatShoppingListForLine`: LINE共有向けに箇条書き化。

---

## 6. CSVインポート解析アルゴリズム

対象: `/Users/jrmag/my-recipe-app/src/utils/csvParser.ts`

### 6-1. CSV構文解析 `parseCSV`
- RFC4180 互換の簡易パーサ（クォート内改行、エスケープ `""` 対応）。

### 6-2. 材料行解析 `parseIngredientLine`
- `食材名: 量` 形式を解析。
- `[a]` や `(メモ)` を除去して正規化。
- 調味料キーワードで `sub` / それ以外 `main` を推定。
- `適量/少々` は `quantity=0, unit='適量'`。

### 6-3. 量・時間・カテゴリ推定
- `parseQuantityUnit`: 分数、`大さじ1/2`、数値+単位を抽出。
- `parseCookingTimeMinutes`: `約45分`, `1時間30分` を分へ。
- `estimateCookingSteps`:
  - 下ごしらえ: `ingredientCount * 1.5` を `[5,20]` にクランプ
  - 盛り付け: 3分固定
  - 機器調理: `total - prep - plate`（最低5分）
- `guessCategory`: タイトルキーワードで `スープ/ご飯もの/デザート/副菜/主菜` を推定。
- `estimateTotalWeight`: 単位別係数で総重量推定し、50g単位丸め（最小200g）。

### 6-4. 重複排除・取込
- 既存タイトル集合を作成し重複スキップ。
- `importHotcookCSV` / `importHealsioCSV` で機器別にレシピ生成。
- `detectCSVType`: ヘッダに `メニュー番号` / `塩分` があるかで判定。

---

## 7. Gemini解析アルゴリズム（レシピ抽出）

対象: `/Users/jrmag/my-recipe-app/src/utils/geminiParser.ts`

- `parseRecipeText`:
  - 固定 `SYSTEM_PROMPT` で JSON フォーマットを強制。
  - 返答のコードフェンス除去後 JSON パース。
- `validateParsedRecipe`:
  - 型/必須項目を検証。
  - `device`, `category`, `ingredient.category` は許容値に丸め。
  - `totalTimeMinutes` 欠損時は steps 合計で補完。
- `parseRecipeFromUrl`:
  - URL を10秒タイムアウト付き取得。
  - JSON-LD (`Recipe`) / OGP画像を抽出して解析テキストを補強。
  - 解析失敗時は明示的エラーへ変換。

---

## 8. Gemini週次献立リファイン（任意）

対象: `/Users/jrmag/my-recipe-app/src/utils/geminiWeeklyMenu.ts`

- ローカル選定後に Gemini で差し替え提案を取得。
- 入力: 現在7日献立 + 代替候補（最大30件）+ ユーザー要望 + 旬食材。
- 出力 JSON: `{ swaps: [{ date, newRecipeId }] }`
- 失敗/キー未設定時は `null` を返し、ローカル献立を維持（フォールバック）。

---

## 9. 家族カレンダー分析アルゴリズム

対象: `/Users/jrmag/my-recipe-app/src/utils/familyCalendarUtils.ts`

- `analyzeFamilySchedule`:
  - 日付単位でイベントを集約。
  - 優先ルール:
    1. 終日予定あり -> 作り置き推奨
    2. 16時以降予定あり -> 時短推奨
    3. 予定3件以上 -> 簡単レシピ推奨
    4. 予定なし -> じっくり料理OK
  - 日付昇順で `MealSuggestionHint[]` を返却。

---

## 10. カレンダー登録時刻計算アルゴリズム

対象: `/Users/jrmag/my-recipe-app/src/utils/weeklyMenuCalendar.ts`

- 献立登録 `registerWeeklyMenuToCalendar`:
  - 食事開始/終了時刻を設定値から生成。
  - 調理通知ON時、`desiredMealTime - totalTimeMinutes` で調理開始推定。
  - カレンダー開始時刻との差分を通知 `minutesBefore` に変換（範囲内のみ登録）。
- 買い物リスト登録 `registerShoppingListToCalendar`:
  - 指定時刻で5分イベントを作成。

---

## 11. Google Drive バックアップ/復元マージ規則

対象:
- `/Users/jrmag/my-recipe-app/src/lib/googleDrive.ts`
- `/Users/jrmag/my-recipe-app/src/hooks/useGoogleDriveSync.ts`

### 11-1. バックアップ
- 保存先: Drive `appDataFolder`
- ファイル探索 `findBackupFile` -> 既存あれば `PATCH`、なければ `multipart POST` で作成。
- すべての Drive API レスポンスで HTTP ステータス検証し、非2xxは文脈付きエラー。

### 11-2. 復元マージ
- `stock`: `name` 重複回避
- `favorites`, `userNotes`: `recipeId` 重複回避
- `viewHistory`, `calendarEvents`: ローカル空のときのみ投入
- `weeklyMenus`: `weekStartDate` 重複回避
- `preferences`: ローカル未設定時のみ投入

### 11-3. 自動同期トリガー
- 初回ログイン時復元
- 5分間隔定期バックアップ
- `online` 復帰時バックアップ
- `beforeunload` 時ベストエフォートバックアップ
- 実行排他: `lockRef` で二重実行を防止

---

## 12. Supabase双方向同期アルゴリズム

対象: `/Users/jrmag/my-recipe-app/src/utils/syncManager.ts`

- `syncAll` 実行順序（依存関係考慮）:
  1. `recipes`
  2. `stock`
  3. `favorites`
  4. `userNotes`
  5. `viewHistory`
  6. `calendarEvents`
  7. `preferences`
  8. `weeklyMenus`
- 戦略: 小規模データ前提のフルテーブル同期。
- 競合方針: 基本は最終更新優先（`updated_at` など）。
- IDマッピング: `recipe` の `local id <-> supabaseId` を構築して関連テーブル同期に使用。
- テーブル別規則:
  - 未同期ローカルを push
  - 同期済みを upsert
  - クラウドにのみ存在する行を pull
  - 一部（stock）はクラウド削除検知でローカル削除
  - `viewHistory` は直近200件に制限

---

## 13. インポート/エクスポートの判定規則

対象:
- `/Users/jrmag/my-recipe-app/src/utils/dataImport.ts`
- `/Users/jrmag/my-recipe-app/src/utils/dataExport.ts`

- `importData`:
  - JSON スキーマ最低限検証 (`version`, `tables`)。
  - `overwrite`: 全対象テーブルクリア後に投入。
  - `merge`: `bulkPut` で主キー単位 upsert。
- `exportData`:
  - 全対象テーブルを1つの JSON に束ねる（`version=1`）。

---

## 14. 材料インデックス生成アルゴリズム

対象: `/Users/jrmag/my-recipe-app/src/utils/ingredientIndex.ts`

- 全レシピを走査し、材料名ごとに単位出現頻度をカウント。
- デフォルト単位は「最頻出かつ非`適量`」を採用。
- 出力を日本語ロケールでソート。

---

## 15. UI層での補助選別ロジック

対象:
- `/Users/jrmag/my-recipe-app/src/components/RecipeList.tsx`
- `/Users/jrmag/my-recipe-app/src/pages/HomePage.tsx`
- `/Users/jrmag/my-recipe-app/src/pages/WeeklyMenuPage.tsx`

- `RecipeList`:
  - DB絞り込み（カテゴリ/機器） + `searchRecipes` + クイック条件（30分以内、旬）
  - ヘルシオデリを下位に回し、在庫一致率降順
- `HomePage`:
  - 旬候補抽出（旬食材一致）
  - 在庫推薦（`getLocalRecommendations`）
- `WeeklyMenuPage`:
  - 差し替え候補を在庫一致率降順で生成
  - お気に入り候補をサブ集合として分離

---

## 備考

- 現在の献立選定は「重み付きスコア + 貪欲法」が中心で、最適化ソルバー（全探索/整数計画法）は未採用です。
- Gemini系は任意機能で、キー未設定や失敗時はローカルアルゴリズムへ確実にフォールバックします。

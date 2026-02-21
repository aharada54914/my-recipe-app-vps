# アルゴリズム仕様一覧

最終改訂: 2026-02-21
対象コードベース: `main` (v1.5.0)

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

- 月ごとに20種類以上の旬食材プールを保持
- 日付（年内通算日）をシードに毎日開始位置をずらして選抜
- 同じ月でも日替わりで提案食材が変化

---

## 3. 在庫一致率

対象: `src/utils/recipeUtils.ts`

- `calculateMatchRate(ingredients, stockNames)`
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

- Fuse.js の重み付き検索
  - title: 2
  - ingredients.name: 1
- 同義語展開後に結果マージ
- 最良スコアで重複排除

---

## 7. AI解析アルゴリズム

対象:
- `src/utils/geminiParser.ts`
- `src/utils/geminiWeeklyMenu.ts`

- URL/テキストからJSON構造を抽出
- 型検証・補完でレシピデータ化
- 週間献立は任意でGeminiリファイン（失敗時フォールバック）

---

## 8. バックアップ/復元マージ

対象: `src/lib/googleDrive.ts`

- 保存先: Google Drive `appDataFolder`
- APIレスポンスは全てHTTPステータス検証
- 復元時はテーブルごとに重複回避マージ

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


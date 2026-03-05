# Architecture Reference

最終改訂: 2026-03-05
対象バージョン: v2.0.0

Kitchen App の現行アーキテクチャ概要です。

---

## 1. 構成概要

- フロントエンド: React 19 + TypeScript + Vite 7
- ルーティング: React Router 7
- ローカルDB: Dexie (IndexedDB)
- 認証/連携: Google OAuth
- バックアップ: Google Drive AppData
- AI: Gemini API
- 通知: Notification API（ローカル通知）

---

## 2. 主要ディレクトリ

- `src/pages` 画面単位コンポーネント
- `src/components` 再利用UI
- `src/utils` アルゴリズム/純ロジック
- `src/db` Dexieスキーマ
- `src/hooks` 認証・設定・同期補助
- `src/lib` 外部APIクライアント
- `api` Vercel Serverless Functions（URL抽出など）
- `docs` 仕様書

---

## 3. データ層

DB: `RecipeDB`（Dexie schema version 9）

主なテーブル:
- `recipes`
- `stock`
- `favorites`
- `userNotes`
- `viewHistory`
- `calendarEvents`
- `userPreferences`
- `weeklyMenus`

初回起動時にCSV由来JSONからレシピを投入。

---

## 4. 画面遷移・UI基盤（v1.5.0）

- `App.tsx` でルーティングを構成
- `SplashScreen` 追加（起動アニメーション）
- `route-enter` アニメーションで画面切替を滑らかに
- `index.css` で Liquid Glass トーンを全体適用
- `GeminiProcessingBanner` がチャット処理中の全画面バナー表示を担当

---

## 5. 週間献立フロー

`WeeklyMenuPage`:
1. `selectWeeklyMenu` で候補選定
2. 主菜 + 副菜/スープを週次保存
3. 買い物リストは主菜・副菜を合わせて集約
4. 共有リンク/共有コードの生成・読込
5. 日次タイルは時刻情報アイコンとガント導線を大きめ表示で統一
6. Google Calendar登録は1日1イベントに主菜+副菜/スープを統合して作成
7. 買い物リストイベントにQRコード画像（Drive経由）とインポートURLを添付
8. `weeklyMenuQr.ts` のハイブリッドエンコードでQRデータをbase64url化

---

## 6. 通知フロー（v1.5.0）

- `NotificationSettings` で権限取得とON/OFF設定
- `NotificationScheduler` が定期チェック
- 通知イベント:
  - 調理開始時刻
  - 週間献立生成完了
  - 買い物リスト表示時（不足あり）

重複通知は日付キーで防止。

---

## 7. Google連携

- OAuthで `providerToken` 取得。スコープ: `drive.appdata`, `drive.file`, `calendar.events`, `calendar.readonly`
- Drive:
  - `backupToGoogleDrive` / `restoreFromGoogleDrive`（appDataFolder）
  - `uploadQrImageToDrive`（drive.fileスコープ、My Driveにイベント添付用QR画像を保存）
- Calendar:
  - 献立イベント（主菜+副菜/スープを1日1イベントに統合）
  - 買い物イベント（QR画像添付 + `?import-menu=<base64>` のインポートURL）
- QR受信: `?import-menu=<base64>` URLパラメータを `App.tsx` で検知 → `WeeklyMenuImportModal` で確認→インポート

---

## 8. URLインポート・AI提案（v1.7.5）

- `api/recipe-extract.js`:
  - 対応ドメインallowlist検証
  - HTML/JSON-LD抽出
- `src/utils/geminiParser.ts`:
  - URL抽出結果を Zodスキーマ (`ParsedRecipeSchema`) に通して Recipe互換JSONへ正規化
- `src/pages/AskGeminiPage.tsx`:
  - 写真 -> 食材文字 -> 献立生成の2段階フロー
  - 再生成時は文字データのみ送信
  - `RecipeEditorModal` で編集後にDB保存
- `src/lib/geminiClient.ts` + `src/lib/geminiSettings.ts`:
  - 機能別モデル選択（Flash-Lite / Flash / 2.5 Flash）
  - URL/画像解析の失敗時上位モデルリトライ
  - 使用量（推定）カウント
- `src/stores/geminiStore.ts`:
  - Geminiチャット送信処理をストア側へ移し、タブ移動後も処理継続
  - 履歴/下書きを localStorage に保持（履歴約3日）

---

## 9. 検索ランク（v1.7.5）

- `RecipeList` は Fuse一致だけでなく、好みシグナルを合成して並び替え
- `preferenceSignals`:
  - `viewHistory`
  - `favorites`
  - `weeklyMenus`
  - `calendarEvents(meal)`
- `preferenceRanker`:
  - Kitchen App Preference Rank (KAPR) を計算

---

## 10. ホームページ天気レコメンド（v2.0.0）

対象:
- `src/pages/HomePage.tsx`
- `src/utils/season-weather/weatherProvider.ts`
- `src/utils/season-weather/weatherScoring.ts`
- `src/utils/season-weather/recipeWeatherVectors.ts`
- `src/utils/season-weather/tOptLearner.ts`

`HomePage` 起動時に気象庁APIから東京7日間予報を取得（`getWeeklyWeatherForecast`）し、今日分の `DailyWeather` を `todayWeather` ステートに保存。

`findTodayRecipes` が Phase2ベクトルスコア × T_opt個人化スコア × 旬スコアの複合値（§13）でレシピをランキングし、Softmax確率的サンプリングで4件を「今日食べたい料理」2×2タイルに表示。詳細は `docs/ALGORITHMS.md` §13〜15 参照。

**season-weather モジュール構成:**

| ファイル | 役割 |
|---|---|
| `weatherProvider.ts` | 気象庁API取得 + 合成フォールバック（`buildSyntheticForecast`） |
| `weatherScoring.ts` | Phase1: 3因子快適スコア / Phase3: T_opt個人化スコア |
| `recipeWeatherVectors.ts` | Phase2: レシピ4Dベクトル算出 + ドット積スコアリング |
| `tOptLearner.ts` | 履歴から T_opt（個人最適気温）を学習・推定 |
| `weatherTagger.ts` | レシピへの天気タグ付与 |
| `weekWeather.ts` | 週スコープ天気フィルタ |
| `weatherIllustrationComposer.ts` | 湿度・降水量レイヤードイラスト合成 |
| `weatherIllustrationTokens.ts` | イラストトークン定義 |

**ヘッダー変更（v2.0.0）:**
- `Header.tsx` に `onStock` プロップを追加し、Packageアイコンボタン（在庫管理へのナビゲーション）をアカウントアイコンと設定アイコンの間に配置
- OAuth設定あり・未ログイン時にコンパクトな「ログイン」ボタンをヘッダーに表示

---

## 11. 非採用/廃止

- Supabase同期層は削除済み（v1.5.0以前の履歴を除く）
- 現在のクラウド連携は Google Drive バックアップ中心

---

## 12. ビルド・配布

- `npm run build`
  - `scripts/prebuild-recipes.mjs`（CSV→JSON）
  - `tsc -b`
  - `vite build`
- PWA: `vite-plugin-pwa`
- `vercel.json` でSPAリライト

---

## 13. コストシステム（v2.0.0）

対象: `src/utils/cost/`

食材の平均価格データ（`src/data/ingredientAveragePrices.ts`）をもとにレシピのコストを推定する。

| ファイル | 役割 |
|---|---|
| `costEstimator.ts` | レシピ1件のコスト合計を計算するエントリポイント |
| `priceResolver.ts` | 食材名と単位から価格を解決（完全一致→類似一致の順） |
| `similarIngredientResolver.ts` | 食材名の表記ゆれを吸収し類似食材の価格を流用 |
| `luxuryExperience.ts` | 高額食材（松茸・カニ・和牛等）を検出しラグジュアリーフラグを付与 |
| `priceSync.ts` | 価格データの同期処理（将来的な外部API連携を想定） |
| `startupPriceSync.ts` | `initDb()` から呼び出す起動時価格同期 |

`UserPreferences.weeklyMenuCostMode` で挙動を制御（`'ignore'` / `'budget'` / `'luxury'`）。詳細は `docs/ALGORITHMS.md` §16 参照。

---

## 14. レシピ特徴行列（v2.0.0）

対象: `src/utils/recipeFeatureMatrix.ts`

`ensureRecipeFeatureMatrix(recipes)` が週間献立選択時にレシピの特徴ベクトルを一括生成・キャッシュする。`selectWeeklyMenu` がスコアリングのために参照する中間データ層。天気ベクトル（§14）とコスト推定（§16）の入力としても使用される。

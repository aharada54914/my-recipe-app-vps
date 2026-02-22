# Architecture Reference

最終改訂: 2026-02-22
対象バージョン: v1.9.0

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

---

## 5. 週間献立フロー

`WeeklyMenuPage`:
1. `selectWeeklyMenu` で候補選定
2. 主菜 + 副菜/スープを週次保存
3. 買い物リストは主菜・副菜を合わせて集約
4. 共有リンク/共有コードの生成・読込
5. 日次タイルは時刻情報アイコンとガント導線を大きめ表示で統一

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

- OAuthで `providerToken` 取得
- Drive:
  - `backupToGoogleDrive`
  - `restoreFromGoogleDrive`
- Calendar:
  - 献立イベント
  - 買い物イベント

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

## 10. 非採用/廃止

- Supabase同期層は削除済み（v1.5.0以前の履歴を除く）
- 現在のクラウド連携は Google Drive バックアップ中心

---

## 11. ビルド・配布

- `npm run build`
  - `scripts/prebuild-recipes.mjs`（CSV→JSON）
  - `tsc -b`
  - `vite build`
- PWA: `vite-plugin-pwa`
- `vercel.json` でSPAリライト

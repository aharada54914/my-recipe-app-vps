# 個人設定ガイド — Kitchen App セットアップ簡易版

最終改訂: 2026-03-07  
対象バージョン: v2.0.0

Kitchen App を使い始めるときに、最初に確認しておくとよい設定だけをまとめた簡易ガイドです。

---

## 1. 設定なしで使える機能

最初から使えるもの:
- レシピ閲覧 / 検索
- お気に入り / 履歴
- 在庫管理
- 週間献立の基本生成
- ライト / ダーク表示の切替

設定が必要なもの:
- Gemini 機能
- Google Drive バックアップ / 復元
- Google Calendar 登録
- 通知

---

## 2. まず設定したい 4 項目

### 2.1 表示

1. `設定 > 表示` を開く
2. `システム / ライト / ダーク` を選ぶ

おすすめ:
- 通常は `システム`
- 夜に使うことが多いなら `ダーク`

### 2.2 Gemini API キー

1. [Google AI Studio](https://aistudio.google.com/app/apikey) で API キーを作る
2. `設定 > AI` を開く
3. API キーを貼り付けて保存
4. `接続テスト` で確認

### 2.3 Google ログイン

1. `設定 > 接続` を開く
2. `Googleでログイン` を押す
3. アカウント情報が表示されれば完了

有効になる機能:
- Google Drive バックアップ / 復元
- Google Calendar 登録

### 2.4 通知

1. `設定 > 通知` を開く
2. `通知を許可` を押す
3. 必要な通知だけ ON にする

---

## 3. 日常の使い方

- すぐ探したいとき
  - `ホーム` の `レシピを検索`
- URL や在庫から相談したいとき
  - `ホーム` の `AI に相談`
- 1 週間まとめて決めたいとき
  - `献立` タブ
- 在庫を足したいとき
  - ヘッダーの在庫ボタン、または `/stock`

---

## 4. よくあるトラブル

### Google ログインボタンが出ない

- `VITE_GOOGLE_CLIENT_ID` が未設定の可能性があります
- 配布元に Google ログインの有効化を確認してください

### AI が使えない

- Gemini API キーの未設定 / 誤設定
- `設定 > AI > 接続テスト` を確認してください

### 通知が来ない

- アプリ側と端末側の通知許可を両方確認してください
- iPhone では PWA と通知許可の両方が必要です

---

## 5. 詳しいガイド

- [docs/SETTINGS_GUIDE.md](/Users/jrmag/my-recipe-app/docs/SETTINGS_GUIDE.md)
- [SETUP_GUIDE_OKAZAKI.md](/Users/jrmag/my-recipe-app/SETUP_GUIDE_OKAZAKI.md)

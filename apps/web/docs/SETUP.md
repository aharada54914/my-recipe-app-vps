# Setup & Deployment Guide

最終改訂: 2026-03-07

このドキュメントは、現行の Kitchen App をローカル開発し、検証し、配布するための基準手順です。

---

## 1. Prerequisites

- Node.js `24` 推奨（最低 `22.12+`）
- npm `10+`
- Google Cloud プロジェクト
  - Google OAuth / Drive / Calendar を使う場合
- Gemini API キー
  - AI 機能を実運用する場合

---

## 2. Local Development

```bash
git clone https://github.com/aharada54914/my-recipe-app.git
cd my-recipe-app
npm install
npm run dev
```

必要に応じて、ルートに `.env` を作成します。

```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GEMINI_API_KEY=your-gemini-api-key
```

補足:
- `VITE_GOOGLE_CLIENT_ID` が未設定でもアプリは起動する
- `VITE_GEMINI_API_KEY` は設定画面保存値より優先される

---

## 3. 推奨確認コマンド

```bash
npm run lint
npm test
npm run build
npm run test:smoke:ci
npm run test:visual
npm run ui:class-audit
```

スナップショット更新が必要な場合:

```bash
npm run test:visual:update
```

---

## 4. Google OAuth Setup

1. Google Cloud Console でプロジェクトを作成
2. 以下の API を有効化
   - Google Drive API
   - Google Calendar API
3. OAuth 同意画面を作成
4. OAuth Client ID を `Web application` で作成
5. Authorized JavaScript origins に登録
   - `http://localhost:5173`
   - 本番 URL
6. `.env` またはホスティング先環境変数に `VITE_GOOGLE_CLIENT_ID` を設定

---

## 5. QA Google モード

実アカウントを使わず connected flow を検証したい場合は QA モードを使います。

- URL: `/settings/advanced?qa-google=1`
- 入口: `設定 > 詳細設定 > 接続フロー検証`
- 旧 URL の `/settings/data?qa-google=1` でも自動的に詳細設定へ移動します
- モック対象:
  - Google ログイン状態
  - Drive バックアップ / 復元
  - Calendar 登録

用途:
- smoke test
- visual regression
- 手動 UI 監査

---

## 6. Build & Deploy

```bash
npm run build
```

ビルド内容:
- `scripts/prebuild-recipes.mjs`
- `tsc -b`
- `vite build`

デプロイ:
- `dist/` を静的配布
- Vercel では `vercel.json` により SPA rewrite 対応済み

本番環境変数:
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GEMINI_API_KEY` 任意

---

## 7. PWA Install

- iOS
  - Safari -> 共有 -> ホーム画面に追加
- Android
  - Chrome -> Install app

---

## 8. Data / Recipe Assets

レシピ JSON を再生成したい場合:

```bash
tsx scripts/prebuild-recipes.mjs
```

`npm run dev` と `npm run build` の前には自動で走ります。

---

## 9. 関連ドキュメント

- [README.md](/Users/jrmag/my-recipe-app/README.md)
- [docs/ARCHITECTURE.md](/Users/jrmag/my-recipe-app/docs/ARCHITECTURE.md)
- [docs/TESTING.md](/Users/jrmag/my-recipe-app/docs/TESTING.md)
- [docs/SETTINGS_GUIDE.md](/Users/jrmag/my-recipe-app/docs/SETTINGS_GUIDE.md)

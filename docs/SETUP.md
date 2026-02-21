# Setup & Deployment Guide

最終改訂: 2026-02-21

このドキュメントは、v1.7.0 時点のセットアップ手順です。

---

## 1. Prerequisites

- Node.js 22.12+
- npm 10+
- Google Cloud プロジェクト（OAuth / Calendar / Drive を使う場合）
- Gemini APIキー（AI機能を使う場合）

---

## 2. Local Development

```bash
git clone https://github.com/aharada54914/my-recipe-app.git
cd my-recipe-app
npm install
cp .env.example .env
npm run dev
```

---

## 3. Env Variables

```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GEMINI_API_KEY=your-gemini-api-key
```

- Google Client ID がない場合: OAuth機能のみ無効
- Geminiキーは設定画面入力でも可（`.env`優先）

---

## 4. Google OAuth Setup

1. Google Cloud Console でプロジェクト作成
2. APIs を有効化
   - Google Calendar API
   - Google Drive API
3. OAuth同意画面を作成（External）
4. OAuth Client ID（Web）を作成
5. Authorized JavaScript origins に以下を登録
   - `http://localhost:5173`
   - 本番URL（例: `https://your-app.vercel.app`）
6. `VITE_GOOGLE_CLIENT_ID` を設定

---

## 5. Notification Setup (PWA)

v1.5.0 以降、通知機能は実動作します。

1. 設定 > 通知 を開く
2. 「通知を許可」をタップ
3. 調理開始通知 / 献立完了通知 / 買い物リスト通知を必要に応じてON

注意:
- iOSはホーム画面追加したPWA + 通知許可が必要
- ローカル通知のため、完全バックグラウンドPushではありません

---

## 6. Build & Deploy

```bash
npm run build
```

- `dist/` を静的ホスティングに配置
- `vercel.json` により SPA リライト対応済み

Vercel環境変数:
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GEMINI_API_KEY`（任意）

---

## 7. PWA Installation

- iOS: Safari -> 共有 -> ホーム画面に追加
- Android: Chrome -> Install app

---

## 8. Data Update

CSVからJSON再生成:

```bash
node scripts/prebuild-recipes.mjs
```

`npm run build` 時に自動実行されます。

---

## 9. Gemini 2段階フロー（在庫提案）

`/gemini -> 在庫から提案` では以下の2段階で処理します。

1. 写真複数枚を送信前に縮小して1枚に結合し、食材文字リストを抽出  
2. 食材文字リストから献立JSON（DB互換）を生成

再生成ボタンは 2. のみ実行するため、2回目以降は文字データのみ送信されます。  
生成レシピは `baseServings` を含むため、アプリ内の人数変更UIと互換です。
生成結果やURL取り込み結果は、保存前に大型編集ウィンドウで材料・分量・手順を修正できます。

---

## 10. URLインポート対応サイト

以下のURLドメインのみサポートしています（アプリ内にも表示）。

- https://www.kyounoryouri.jp/
- https://oceans-nadia.com/
- https://recipe.rakuten.co.jp/
- https://macaro-ni.jp/
- https://erecipe.woman.excite.co.jp/
- https://www.kikkoman.co.jp/homecook/
- https://park.ajinomoto.co.jp/
- https://foodistnote.recipe-blog.jp/
- https://bazurecipe.com/
- https://cookien.com/

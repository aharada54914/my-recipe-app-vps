# 最初のセットアップを1行ずつ説明

最終更新: 2026-04-03

## この repository は何をするものか

Kitchen Platform は、料理まわりの運用をまとめる monorepo です。

- `apps/web`: 家族が使う PWA
- `apps/api`: 認証、設定保存、週間献立、料理相談の backend
- `apps/discord-bot`: Discord workflow bot
- `apps/mcp-server`: Claude などから使う MCP サーバー
- `packages/shared-types`: 共通の型

## 先に必要なもの

- Git
- Node.js `24` 推奨
- 最低でも Node.js `22.12.0`
- npm
- Postgres を使うなら Docker または手元の DB

確認コマンド:

```bash
node -v
npm -v
git --version
docker --version
```

## セットアップ手順

### 1. コードをコピーする

```bash
git clone https://github.com/aharada54914/my-recipe-app-vps.git
```

意味:

GitHub 上の repo を手元に複製します。

### 2. 作業フォルダへ移動する

```bash
cd my-recipe-app-vps
```

### 3. 依存を入れる

```bash
npm install
```

意味:

- root workspace の依存を入れます
- `packages/shared-types` の build が走ります
- `apps/api` の Prisma client も生成されます

### 4. 設定ファイルを作る

```bash
cp env.example .env
```

### 5. `.env` を開く

```bash
nano .env
```

### 6. 最低限の値を入れる

ローカル開発なら最初はこれで十分です。

```env
DB_PASSWORD=change_me
DATABASE_URL=postgresql://kitchen:change_me@localhost:5432/kitchen_app
JWT_SECRET=change_me_to_a_random_64_char_string
JWT_EXPIRES_IN=7d
API_PORT=3001
API_HOST=0.0.0.0
FRONTEND_URL=http://localhost:5173
TZ=Asia/Tokyo
WEEKLY_EMAIL_CRON="0 8 * * 1"
ENABLE_WEEKLY_EMAIL_JOB=false
NODE_ENV=development
```

意味:

- `DB_PASSWORD`: DB パスワード
- `DATABASE_URL`: API と MCP server が DB へつなぐ先
- `JWT_SECRET`: 認証トークンの署名鍵
- `FRONTEND_URL`: ブラウザ側の origin
- `WEEKLY_EMAIL_CRON`: 週次ジョブ時刻。引用符付きで入れる
- `ENABLE_WEEKLY_EMAIL_JOB=false`: ローカルで job を止める

必要に応じて追加:

- Google 連携: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Gemini: `GEMINI_API_KEY` または `GEMINI_PHOTO_*`, `GEMINI_ADVICE_*`
- Discord bot: `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`, `DISCORD_GUILD_ID`, `DISCORD_INTERNAL_API_TOKEN`
- MCP: `MCP_AUTH_TOKEN`

### 7. Web を起動する

```bash
npm run dev
```

意味:

Vite dev server が立ち上がります。

### 8. API を別ターミナルで起動する

```bash
npm run dev:api
```

意味:

週間献立、設定保存、料理相談、Discord internal route は API が必要です。

### 9. MCP を使うなら別ターミナルで起動する

```bash
npm --workspace apps/mcp-server run dev
```

意味:

Claude などの MCP client から使うサーバーです。

### 10. Discord bot を使うなら別ターミナルで起動する

```bash
npm run dev:discord-bot
```

意味:

Discord workflow の動作確認用です。API が先に起動している必要があります。

### 11. 動作確認する

Web:

```text
http://localhost:5173
```

API health:

```text
http://localhost:3001/api/health
```

MCP health:

```text
http://localhost:3002/health
```

## 最初に触るおすすめ順

1. `/search` でレシピ検索
2. `/stock` で在庫入力
3. `/weekly-menu` で献立生成
4. `/gemini` で料理相談
5. MCP が必要なら client から `/mcp` に接続

## よく使う確認コマンド

```bash
npm run build
npm test
npm run test:api
npm run test:web
npm run test:mcp-server
```

Discord bot だけ確認したい場合:

```bash
npm --workspace apps/discord-bot run build
```

## つまずきやすい点

1. `npm run dev` だけでは API も MCP も起動しません
2. `DATABASE_URL` の host は、自分の起動方法に合わせて変える必要があります
3. `WEEKLY_EMAIL_CRON` は引用符を外すと shell や Compose で壊れやすいです
4. Discord bot は API を直接叩くので、MCP を起動しても bot には効きません

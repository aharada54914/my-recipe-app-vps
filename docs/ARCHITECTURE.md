# Architecture

最終更新: 2026-04-03

## 目的

このドキュメントは、Kitchen Platform の現行構成を開発者向けに整理したものです。  
Web アプリ、API、Discord bot、MCP サーバー、VPS 運用の接続関係を最新状態で把握するための正本として扱います。

## 全体像

```text
Users
  -> Web App (apps/web)
  -> Discord Bot (apps/discord-bot)
  -> MCP Client / Claude (apps/mcp-server)

apps/web ----------> apps/api ----------> postgres
apps/discord-bot --> apps/api ----------> postgres
apps/mcp-server ---> postgres
```

## Workspace 構成

| パス | 役割 | 主な技術 |
| --- | --- | --- |
| `apps/web` | PWA と UI | React 19, Vite, Tailwind, Dexie, Vitest, Playwright |
| `apps/api` | 認証、設定、週間献立、料理相談、Discord internal API | Fastify, Prisma, Postgres, Zod |
| `apps/discord-bot` | Discord slash command と workflow orchestration | discord.js, TypeScript |
| `apps/mcp-server` | MCP prompt/resource server | `@modelcontextprotocol/sdk`, Prisma, Pino |
| `apps/cli` | 補助 CLI | TypeScript |
| `packages/shared-types` | shared contract | TypeScript, Zod |

## Web アプリ

`apps/web` はエンドユーザー向けの UI です。

主な画面:

- `/search`
- `/stock`
- `/weekly-menu`
- `/favorites`
- `/history`
- `/gemini`
- `/settings/:tab`

責務:

- 画面表示とユーザー操作
- IndexedDB を使ったローカルデータ保持
- API / Google 連携 / QR 導線
- QA モードや visual regression 向けの UI テスト

## API

`apps/api` は Fastify ベースの backend です。

主な責務:

- `/api/health`
- 認証
- preferences 保存
- recipe search / import 関連
- weekly menu 生成と shopping list
- consultation
- Discord 用 internal route

備考:

- Prisma client を利用して Postgres に接続する
- 週次メール job は `ENABLE_WEEKLY_EMAIL_JOB` で制御する

## Discord Bot

`apps/discord-bot` は Discord 上の workflow 実行面です。  
MCP とは独立しており、`KITCHEN_API_BASE_URL` 経由で API を呼びます。

主な workflow:

- URL レシピ取込
- 週間献立
- 写真で在庫提案
- 料理相談

運用ポイント:

- 各 workflow は `/bind-channel` でチャンネルに紐付ける
- bot 単体では完結せず、API と guild 設定が必要

## MCP Server

`apps/mcp-server` は Streamable HTTP の MCP サーバーです。  
現在は `prompt` と `resource` を主導線にし、tool は絞っています。

### 公開形態

- path: `/mcp`
- health: `/mcp/health`
- auth: `Authorization: Bearer <MCP_AUTH_TOKEN>`
- protocol: current SDK default protocol version

### 現行 capability

- Tool:
  - `search_recipes`
- Prompts:
  - `kitchen_advice`
  - `weekly_menu_review`
- Resources:
  - `kitchen://service/info`
  - `kitchen://menu/current-week`
  - `kitchen://stock/{userId}`
  - `kitchen://menu/today/{userId}`
  - `kitchen://menu/weekly/{userId}/{weekStartDate}`
  - `kitchen://shopping-list/{userId}/{weekStartDate}`

### 設計意図

- 読み取り系 kitchen state は resource に寄せる
- AI への指示は prompt に寄せる
- active computation だけ tool に残す
- stdout JSON ログで `request_id`, `session_id`, `kind`, `name`, `latency_ms`, `status` を追えるようにする

## Production Topology

本番は単一 Debian VPS です。

```text
Internet
  -> host front-caddy
  -> docker compose nginx (127.0.0.1:8081:80)
     -> web
     -> api
     -> mcp-server

discord-bot -> api
api + mcp-server -> postgres
```

Compose services:

- `web`
- `api`
- `discord-bot`
- `mcp-server`
- `postgres`
- `nginx`

ポイント:

- `api` と `web` と `mcp-server` は直接公開しない
- compose `nginx` は host に対して `127.0.0.1:8081` で待ち受ける
- 外部公開は host 側 reverse proxy から入る

## データフロー

### Web ユーザー

1. ブラウザが `web` へアクセス
2. `web` が API へリクエスト
3. `api` が Postgres を読み書き
4. 必要に応じて Google や Gemini を利用

### Discord workflow

1. Discord slash command 実行
2. `discord-bot` が API internal route を呼ぶ
3. `api` が DB と AI provider を使って処理
4. `discord-bot` が thread / message に結果を返す

### MCP client

1. Claude などの MCP client が `/mcp` に接続
2. `mcp-server` が prompt/resource/tool を提供
3. kitchen state は Postgres から取得
4. 生成はクライアント側で行い、server 側は context を返す

## ドキュメントの正本

構成変更時は最低でも以下を揃えること:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/manuals/FIRST_SETUP_LINE_BY_LINE.md`
- `docs/manuals/VPS_PRODUCTION_MANUAL.md`
- `OPS_RUNBOOK.md`

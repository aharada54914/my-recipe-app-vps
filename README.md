# Kitchen Platform

最終更新: 2026-04-03

Kitchen Platform は、家庭の料理運用をまとめて扱う monorepo です。
エンドユーザー向けの PWA、Fastify API、Discord bot、MCP サーバー、運用スクリプトを 1 つの repo で管理しています。

## 何ができるか

- Web アプリでレシピ検索、在庫管理、週間献立、買い物リスト、Google 連携を扱う
- API で認証、設定保存、週間献立、料理相談、Discord 向け internal endpoint を提供する
- Discord bot で `週間献立`、`写真で在庫提案`、`料理相談`、`URLレシピ取込` の workflow を運用する
- MCP サーバーで kitchen context を `prompt` と `resource` 中心に提供する
- 単一 VPS 上で `web / api / discord-bot / mcp-server / postgres / nginx` を Compose 運用する

## リポジトリ構成

| パス | 役割 |
| --- | --- |
| `apps/web` | React 19 + Vite の PWA |
| `apps/api` | Fastify + Prisma の API |
| `apps/discord-bot` | Discord slash command / workflow bot |
| `apps/mcp-server` | Streamable HTTP の MCP server |
| `apps/cli` | 補助 CLI |
| `packages/shared-types` | Web / API / Bot で共有する型 |
| `scripts/ops` | VPS 運用コマンド |
| `docs` | セットアップ、運用、QA、設計資料 |

## アーキテクチャ概要

ローカル開発:

```text
apps/web (5173) -> apps/api (3001) -> postgres
apps/discord-bot --------^
apps/mcp-server ---------^
```

本番 VPS:

```text
Internet
  -> front-caddy (host)
  -> docker compose nginx (127.0.0.1:8081:80)
     -> web
     -> api
     -> mcp-server

discord-bot -> api
api + mcp-server -> postgres
```

詳細は [docs/ARCHITECTURE.md](/Users/jrmag/my-recipe-vps/docs/ARCHITECTURE.md) を参照してください。

## クイックスタート

Node.js `24` 推奨、最低 `22.12.0` 以上です。

```bash
git clone https://github.com/aharada54914/my-recipe-app-vps.git
cd my-recipe-app-vps
npm install
cp env.example .env
```

最低限の開発では `.env` に以下があると扱いやすいです。

```env
DB_PASSWORD=change_me
DATABASE_URL=postgresql://kitchen:change_me@localhost:5432/kitchen_app
JWT_SECRET=change_me_to_a_random_64_char_string
JWT_EXPIRES_IN=7d
API_PORT=3001
API_HOST=0.0.0.0
FRONTEND_URL=http://localhost:5173
TZ=Asia/Tokyo
ENABLE_WEEKLY_EMAIL_JOB=false
NODE_ENV=development
```

よく使う起動方法:

```bash
npm run dev
npm run dev:api
npm run dev:discord-bot
npm --workspace apps/mcp-server run dev
```

補足:

- `npm run dev` は Web のみです
- API を伴う機能確認では `npm run dev:api` が必要です
- Discord workflow の確認には Discord bot と API の両方が必要です
- MCP 確認には `apps/mcp-server` を別で起動します
- Prisma client は root `postinstall` で自動生成されます

## 主要コマンド

```bash
npm run build
npm run build:web
npm run build:api
npm run build:discord-bot
npm run build:mcp-server

npm test
npm run test:api
npm run test:web
npm run test:mcp-server
npm run test:smoke:ci
npm run test:visual

npm run ops:ps
npm run ops:health
npm run ops:logs
```

各 workspace 直下の主なコマンド:

- `apps/web`: `dev`, `build`, `test`, `test:smoke:ci`, `test:visual`
- `apps/api`: `dev`, `build`, `test`, `db:generate`, `db:migrate`, `db:push`, `db:seed`
- `apps/discord-bot`: `dev`, `build`, `test:e2e`
- `apps/mcp-server`: `dev`, `build`, `test`

## Web アプリの使い方

主な導線:

- `/search`: レシピ検索
- `/stock`: 在庫管理
- `/weekly-menu`: 週間献立と買い物リスト
- `/gemini`: 料理相談
- `/favorites`: お気に入り
- `/history`: 履歴
- `/settings/:tab`: 各種設定

最初に触る順番:

1. `/search` でレシピを探す
2. `/stock` で家にある食材を登録する
3. `/weekly-menu` で 1 週間分の献立を作る
4. `/gemini` で料理相談を試す
5. `/settings` で Google 連携や表示設定を整える

## MCP サーバーの使い方

MCP は `apps/mcp-server` で提供しています。現在の主導線は `tool` ではなく `prompt` と `resource` です。

- 公開 endpoint: `http://<host>/mcp`
- health: `http://<host>/mcp/health`
- transport: Streamable HTTP
- auth: `Authorization: Bearer <MCP_AUTH_TOKEN>`

主要 surface:

- Tool: `search_recipes`
- Prompts: `kitchen_advice`, `weekly_menu_review`
- Resources:
  - `kitchen://service/info`
  - `kitchen://menu/current-week`
  - `kitchen://stock/{userId}`
  - `kitchen://menu/today/{userId}`
  - `kitchen://menu/weekly/{userId}/{weekStartDate}`
  - `kitchen://shopping-list/{userId}/{weekStartDate}`

## Discord bot の使い方

Discord bot は API を直接利用し、MCP は使いません。主な slash command:

- `/bind-channel`
- `/import-url`
- `/help`
- `/sync-help`
- 週間献立 workflow
- 写真で在庫提案 workflow
- 料理相談 workflow

workflow ごとにチャンネルを bind してから使います。詳細は [docs/qa/DISCORD_E2E_HARNESS.md](/Users/jrmag/my-recipe-vps/docs/qa/DISCORD_E2E_HARNESS.md) を参照してください。

## 本番運用の前提

- デプロイ先: 単一 Debian VPS
- 配置先: `/opt/kitchen-app`
- Compose services: `web`, `api`, `discord-bot`, `mcp-server`, `postgres`, `nginx`
- 公開経路: host `front-caddy` -> compose `nginx` (`127.0.0.1:8081`)

VPS 運用は [docs/manuals/VPS_PRODUCTION_MANUAL.md](/Users/jrmag/my-recipe-vps/docs/manuals/VPS_PRODUCTION_MANUAL.md) と [OPS_RUNBOOK.md](/Users/jrmag/my-recipe-vps/OPS_RUNBOOK.md) を参照してください。

## ドキュメント

- [docs/ARCHITECTURE.md](/Users/jrmag/my-recipe-vps/docs/ARCHITECTURE.md): 現行アーキテクチャとデータフロー
- [docs/manuals/FIRST_SETUP_LINE_BY_LINE.md](/Users/jrmag/my-recipe-vps/docs/manuals/FIRST_SETUP_LINE_BY_LINE.md): ローカルセットアップを 1 行ずつ説明
- [docs/manuals/VPS_PRODUCTION_MANUAL.md](/Users/jrmag/my-recipe-vps/docs/manuals/VPS_PRODUCTION_MANUAL.md): VPS 本番運用の正本
- [OPS_RUNBOOK.md](/Users/jrmag/my-recipe-vps/OPS_RUNBOOK.md): 障害対応と日常運用メモ
- [docs/MCP_REFACTORING_PLAN_V2.md](/Users/jrmag/my-recipe-vps/docs/MCP_REFACTORING_PLAN_V2.md): MCP 再設計の検討メモ
- [docs/qa/DISCORD_E2E_HARNESS.md](/Users/jrmag/my-recipe-vps/docs/qa/DISCORD_E2E_HARNESS.md): Discord E2E の進め方
- [docs/qa/QA_MATRIX_2026-03-28.md](/Users/jrmag/my-recipe-vps/docs/qa/QA_MATRIX_2026-03-28.md): QA ケース一覧
- [docs/qa/QA_RUN_2026-03-28.md](/Users/jrmag/my-recipe-vps/docs/qa/QA_RUN_2026-03-28.md): QA 実施ログ

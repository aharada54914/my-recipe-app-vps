# CLAUDE.md

This repository is a monorepo for the Kitchen Platform.
Keep documentation and implementation aligned with the current production shape, not the older frontend-only app.

## Workspace Map

- `apps/web`: React 19 + Vite PWA for end users
- `apps/api`: Fastify + Prisma API
- `apps/discord-bot`: Discord workflow bot that talks to the API
- `apps/mcp-server`: MCP server over Streamable HTTP
- `apps/cli`: support CLI
- `packages/shared-types`: shared contracts across web, api, and bot

## Common Commands

From repo root:

```bash
npm install

npm run dev
npm run dev:api
npm run dev:discord-bot
npm --workspace apps/mcp-server run dev

npm run build
npm run test
npm run test:api
npm run test:web
npm run test:mcp-server

npm run ops:ps
npm run ops:health
npm run ops:logs
```

Workspace-specific:

```bash
npm --workspace apps/api run dev
npm --workspace apps/api run test
npm --workspace apps/discord-bot run test:e2e
npm --workspace apps/mcp-server run test
npm --workspace apps/web run test:smoke:ci
```

## Runtime Architecture

Local development:

- `apps/web` on Vite dev server
- `apps/api` on Fastify
- `apps/discord-bot` calling internal API routes
- `apps/mcp-server` exposing Streamable HTTP MCP

Production VPS:

- public traffic first reaches host `front-caddy`
- `front-caddy` forwards to compose `nginx` on `127.0.0.1:8081`
- compose `nginx` routes to `web`, `api`, and `mcp-server`
- `discord-bot` talks to `api` on the internal compose network
- `api` and `mcp-server` both use Postgres

## MCP Notes

- endpoint path is `/mcp`
- health path is `/mcp/health`
- transport is Streamable HTTP
- auth is Bearer token via `MCP_AUTH_TOKEN`
- primary interface is `prompts` + `resources`, not a large tool surface

Current MCP surface:

- Tool: `search_recipes`
- Prompts: `kitchen_advice`, `weekly_menu_review`
- Resources:
  - `kitchen://service/info`
  - `kitchen://menu/current-week`
  - `kitchen://stock/{userId}`
  - `kitchen://menu/today/{userId}`
  - `kitchen://menu/weekly/{userId}/{weekStartDate}`
  - `kitchen://shopping-list/{userId}/{weekStartDate}`

## Documentation Authority

When updating docs, keep these in sync first:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/manuals/FIRST_SETUP_LINE_BY_LINE.md`
- `docs/manuals/VPS_PRODUCTION_MANUAL.md`
- `OPS_RUNBOOK.md`

Do not leave links pointing at the old `my-recipe-app` repo paths.

## Environment Notes

Base env file:

- copy `env.example` to `.env`

Important variables:

- database: `DB_PASSWORD`, `DATABASE_URL`
- auth: `JWT_SECRET`, `JWT_EXPIRES_IN`
- frontend/api origin: `FRONTEND_URL`, `APP_DOMAIN`
- Discord: `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`, `DISCORD_GUILD_ID`, `DISCORD_INTERNAL_API_TOKEN`
- MCP: `MCP_AUTH_TOKEN`
- AI: `GEMINI_*`
- cron: `WEEKLY_EMAIL_CRON`, `ENABLE_WEEKLY_EMAIL_JOB`

`WEEKLY_EMAIL_CRON` must stay quoted in `.env`, for example:

```env
WEEKLY_EMAIL_CRON="0 8 * * 1"
```

## Deployment Notes

- VPS runtime path is `/opt/kitchen-app`
- the deployed tree may be synchronized into place instead of being a clean git checkout
- do not assume `git pull` is always the production update path
- verify with `bash scripts/ops/kitchenctl.sh ps` and `bash scripts/ops/kitchenctl.sh health`

## Testing Expectations

For repo-wide changes, prefer running:

```bash
npm run build
npm run test
```

For docs-only changes, at minimum verify:

- referenced files exist
- commands still match `package.json`
- production topology still matches `docker-compose.yml` and `nginx.conf`

## Code Change Guidance

- backend-only or data-only tasks do not need frontend optimization guidance
- MCP changes should keep Streamable HTTP unless there is an explicit migration decision
- Discord bot talks to the API directly; it is not an MCP client
- production secrets and live tokens must not be written into docs or committed files

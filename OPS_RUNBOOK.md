# OPS Runbook

最終更新: 2026-04-03

このドキュメントは、単一 Debian VPS で Kitchen Platform を運用するときの実務メモです。
詳細手順の正本は [docs/manuals/VPS_PRODUCTION_MANUAL.md](/Users/jrmag/my-recipe-vps/docs/manuals/VPS_PRODUCTION_MANUAL.md) とし、ここでは障害対応と日常運用を短くまとめます。

## 本番トポロジ

```text
Internet
  -> front-caddy (host)
  -> 127.0.0.1:8081 (compose nginx)
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

## 最初に見るコマンド

```bash
bash scripts/ops/kitchenctl.sh health
bash scripts/ops/kitchenctl.sh ps
bash scripts/ops/kitchenctl.sh logs
```

個別確認:

```bash
bash scripts/ops/kitchenctl.sh logs api
bash scripts/ops/kitchenctl.sh logs mcp-server
bash scripts/ops/kitchenctl.sh logs discord-bot
```

## 公開 endpoint

- Web: `https://yourdomain.com/`
- API health: `https://yourdomain.com/api/health`
- MCP: `https://yourdomain.com/mcp`
- MCP health: `https://yourdomain.com/mcp/health`

## 日常運用

再起動:

```bash
bash scripts/ops/kitchenctl.sh restart
bash scripts/ops/kitchenctl.sh restart api
bash scripts/ops/kitchenctl.sh restart mcp-server
```

DB バックアップ:

```bash
bash scripts/ops/kitchenctl.sh backup-db
bash scripts/ops/kitchenctl.sh prune-backups
```

復元:

```bash
bash scripts/ops/kitchenctl.sh restore-db backups/kitchen_app-YYYYMMDD-HHMMSS.sql.gz
```

## よくある確認ポイント

### Web が見えない

1. `front-caddy` 側のルーティングを確認
2. `bash scripts/ops/kitchenctl.sh ps`
3. `docker compose logs nginx --tail=100`
4. `docker compose logs web --tail=100`

### API が失敗する

1. `https://yourdomain.com/api/health` を確認
2. `bash scripts/ops/kitchenctl.sh logs api`
3. `postgres` health を確認
4. `.env` の `DATABASE_URL`, `JWT_SECRET` を確認

### MCP がつながらない

1. `https://yourdomain.com/mcp/health` を確認
2. `bash scripts/ops/kitchenctl.sh logs mcp-server`
3. `docker compose logs nginx --tail=100`
4. client が `Authorization: Bearer <MCP_AUTH_TOKEN>` を送っているか確認
5. `mcp-session-id` 周辺の session ログを確認

### Discord bot が動かない

1. `bash scripts/ops/kitchenctl.sh logs discord-bot`
2. `.env` の `DISCORD_*` と `KITCHEN_API_BASE_URL` を確認
3. API internal route の health と auth token を確認

## localhost トンネルでの確認

Google OAuth やローカル origin 確認では SSH トンネルを使います。

```bash
bash scripts/ops/open-localhost-tunnel.sh
```

別 port:

```bash
bash scripts/ops/open-localhost-tunnel.sh 3001
```

## deploy 時の実務ルール

1. `.env` は現地のものを保持する
2. 本番配置が git checkout とは限らない
3. 同期後は `kitchenctl.sh up` か再 build を実施する
4. `health` と公開 endpoint を必ず確認する
5. MCP を触ったら `/mcp/health` と client 接続の両方を確認する

## systemd

```bash
systemctl status kitchen-app.service
systemctl is-enabled kitchen-app.service
systemctl list-timers | grep kitchen-app
journalctl -u kitchen-app.service -n 100 --no-pager
```

## 運用メモ

- `WEEKLY_EMAIL_CRON` は引用符付きで保持する
- Discord bot は API を直接使う。MCP ではない
- `api`, `web`, `mcp-server` を host に直接 bind しない
- 監視を強めるなら外部監視を別途追加する

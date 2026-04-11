# VPS 本番運用マニュアル

最終更新: 2026-04-03

## この本番環境の前提

このアプリは単一 Debian VPS 上で常時運用します。

- サーバー: `178.104.88.252`
- 配置先: `/opt/kitchen-app`
- コンテナ管理: Docker Compose
- 自動起動: `systemd`
- 公開経路: host `front-caddy` -> compose `nginx`

## サーバー内で動くもの

| サービス | 役割 |
| --- | --- |
| `front-caddy` | host 側の公開 reverse proxy |
| `nginx` | compose 内部の reverse proxy |
| `web` | PWA 配信 |
| `api` | 認証、設定、週間献立、料理相談、Discord internal API |
| `mcp-server` | Streamable HTTP の MCP server |
| `discord-bot` | Discord workflow bot |
| `postgres` | 永続 DB |

## 公開経路

```text
Internet
  -> front-caddy
  -> 127.0.0.1:8081 (compose nginx)
     -> /        web
     -> /api     api
     -> /mcp     mcp-server
```

補足:

- compose `nginx` は host に対して `127.0.0.1:8081:80` で bind している
- `api`, `web`, `mcp-server` は直接公開しない
- Discord bot は外部公開しない

## 重要ファイル

| ファイル | 役割 |
| --- | --- |
| `/opt/kitchen-app/.env` | 本番環境変数 |
| `/opt/kitchen-app/docker-compose.yml` | 本番 stack 定義 |
| `/opt/kitchen-app/nginx.conf` | compose nginx ルーティング |
| `/opt/kitchen-app/scripts/ops/kitchenctl.sh` | 日常運用コマンド |
| `scripts/ops/sync-vps-runtime.sh` | ローカル作業ツリーを `/opt/kitchen-app` へ同期する補助スクリプト |
| `/etc/systemd/system/kitchen-app.service` | stack 自動起動 |
| `/etc/systemd/system/kitchen-app-backup.timer` | DB バックアップ timer |

## 初回起動または再構築手順

### 1. サーバーへ入る

```bash
ssh aharada@178.104.88.252
```

### 2. 配置先へ移動する

```bash
cd /opt/kitchen-app
```

### 3. `.env` を確認する

```bash
nano /opt/kitchen-app/.env
```

最低限重要な項目:

```env
DB_PASSWORD=strong_password
DATABASE_URL=postgresql://kitchen:strong_password@postgres:5432/kitchen_app
JWT_SECRET=long_random_secret
JWT_EXPIRES_IN=7d
API_PORT=3001
API_HOST=0.0.0.0
FRONTEND_URL=https://yourdomain.com
APP_DOMAIN=yourdomain.com
MCP_AUTH_TOKEN=random_secret_token
TZ=Asia/Tokyo
WEEKLY_EMAIL_CRON="0 8 * * 1"
ENABLE_WEEKLY_EMAIL_JOB=true
NODE_ENV=production
```

注意:

- `WEEKLY_EMAIL_CRON` は引用符付きで保持する
- `MCP_AUTH_TOKEN` がないと `/mcp` の利用者認証ができない
- `.env` に live token や secret が入るので commit しない

### 4. stack を起動する

```bash
bash scripts/ops/kitchenctl.sh up
```

### 5. 状態確認する

```bash
bash scripts/ops/kitchenctl.sh ps
```

期待:

- `api` healthy
- `web` healthy
- `mcp-server` healthy
- `nginx` healthy
- `postgres` healthy
- `discord-bot` running

### 6. ヘルスチェックする

```bash
bash scripts/ops/kitchenctl.sh health
```

### 7. 公開経路を確認する

Web:

```text
https://yourdomain.com/
```

API health:

```text
https://yourdomain.com/api/health
```

MCP health:

```text
https://yourdomain.com/mcp/health
```

## MCP 運用

MCP endpoint:

```text
https://yourdomain.com/mcp
```

利用条件:

- transport: Streamable HTTP
- header: `Authorization: Bearer <MCP_AUTH_TOKEN>`

運用確認例:

```bash
curl -i https://yourdomain.com/mcp/health
```

## 日常運用コマンド

```bash
bash scripts/ops/kitchenctl.sh ps
bash scripts/ops/kitchenctl.sh logs
bash scripts/ops/kitchenctl.sh logs api
bash scripts/ops/kitchenctl.sh logs mcp-server
bash scripts/ops/kitchenctl.sh restart
bash scripts/ops/kitchenctl.sh restart api
bash scripts/ops/kitchenctl.sh health
bash scripts/ops/kitchenctl.sh backup-db
bash scripts/ops/kitchenctl.sh prune-backups
```

## deploy 時の注意

この VPS の `/opt/kitchen-app` は、常に git checkout とは限りません。
更新方法は `git pull` 前提で決め打ちせず、実態に合わせて同期方式を選びます。

原則:

1. 現地の `.env` は上書きしない
2. `docker-compose.yml`, `nginx.conf`, `apps/*`, `packages/*`, `scripts/ops/*` を同期する
3. `bash scripts/ops/kitchenctl.sh up --build` 相当で再構築する
4. `health` と公開 endpoint を確認する

推奨手順:

```bash
bash scripts/ops/sync-vps-runtime.sh
```

補足:

- remote staging は `/tmp/kitchen-app-sync`
- 既定では `root@178.104.88.252:/opt/kitchen-app` へ同期する
- `.env`, `ssl/`, `backups/` は保護して上書きしない
- build だけ止めたい場合は `bash scripts/ops/sync-vps-runtime.sh --sync-only`

## systemd 管理

状態確認:

```bash
systemctl status kitchen-app.service
```

再起動:

```bash
sudo systemctl restart kitchen-app.service
```

timer 確認:

```bash
systemctl list-timers | grep kitchen-app
```

## バックアップ

手動バックアップ:

```bash
bash scripts/ops/kitchenctl.sh backup-db
```

復元:

```bash
bash scripts/ops/kitchenctl.sh restore-db backups/ファイル名.sql.gz
```

## 障害対応の基本順

1. `bash scripts/ops/kitchenctl.sh health`
2. `bash scripts/ops/kitchenctl.sh ps`
3. `bash scripts/ops/kitchenctl.sh logs`
4. `bash scripts/ops/kitchenctl.sh logs api`
5. `bash scripts/ops/kitchenctl.sh logs mcp-server`
6. `journalctl -u kitchen-app.service -n 100 --no-pager`

## 覚えるべきこと

1. 困ったら最初に `health`
2. `.env` は秘密情報込みなので慎重に扱う
3. `WEEKLY_EMAIL_CRON` は引用符付き
4. MCP の外部公開は `/mcp`、health は `/mcp/health`
5. Discord bot は MCP ではなく API を使う

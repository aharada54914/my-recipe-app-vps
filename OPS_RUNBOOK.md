# OPS Runbook

このドキュメントは、単一 Debian VPS 上で Kitchen App を 24時間365日運用する前提の運用メモです。

## 前提

- 単一ホスト構成
- 4 vCPU / 8 GB RAM / 80 GB disk
- Docker Engine と Docker Compose plugin をインストール済み
- ドメインを `APP_DOMAIN` に向けている
- SSH コンソールから運用する

## 構成

- `web`: 静的 frontend 配信
- `api`: Fastify API と定期ジョブ
- `postgres`: 永続 DB
- `nginx`: 公開 reverse proxy / TLS 終端

## 重要な運用方針

- `api` と `web` はホストに直接公開しない
- 外部公開は `nginx` の 80/443 のみ
- DB バックアップは日次で取得する
- TLS は host certbot で更新し、`scripts/ops/sync-letsencrypt.sh` で compose 側へ反映する
- 初回起動時は self-signed 証明書で nginx を立ち上げ、あとから本番証明書へ差し替える
- 復旧操作は `scripts/ops/kitchenctl.sh` だけで完結できるようにする

## 初回セットアップ

1. `.env` を `env.example` から作る
2. `APP_DOMAIN`, `FRONTEND_URL`, `DATABASE_URL`, `DB_PASSWORD`, `JWT_SECRET` を設定する
3. `mkdir -p backups ssl`
4. `bash scripts/ops/kitchenctl.sh up`
5. 初回 `up` で self-signed 証明書が自動生成される
6. 初回 TLS 発行後に `bash scripts/ops/kitchenctl.sh sync-cert`
7. `bash scripts/ops/kitchenctl.sh health`

## 日常運用コマンド

```bash
bash scripts/ops/kitchenctl.sh ps
bash scripts/ops/kitchenctl.sh logs
bash scripts/ops/kitchenctl.sh logs api
bash scripts/ops/kitchenctl.sh restart api
bash scripts/ops/kitchenctl.sh health
bash scripts/ops/kitchenctl.sh backup-db
bash scripts/ops/kitchenctl.sh prune-backups
```

## バックアップ

- DB dump は `backups/` に `*.sql.gz` で保存
- 7日以上残さない場合は host cron または systemd timer 側で削除する
- 復元:

```bash
bash scripts/ops/kitchenctl.sh restore-db backups/kitchen_app-YYYYMMDD-HHMMSS.sql.gz
```

## TLS 更新

host 側 certbot の deploy hook から以下を呼ぶ:

```bash
bash /path/to/repo/scripts/ops/sync-letsencrypt.sh
```

この script は `/etc/letsencrypt/live/$APP_DOMAIN` の証明書を `./ssl` に同期し、`nginx` を再起動する。

本番証明書発行前は self-signed 証明書で起動するため、ブラウザ警告は出る。

## systemd

- stack 自動起動: `ops/systemd/kitchen-app.service`
- 日次バックアップ: `ops/systemd/kitchen-app-backup.service` と `ops/systemd/kitchen-app-backup.timer`

配置先は `/etc/systemd/system/` を想定。

## 既知の制約

- `api` の weekly email job は単一インスタンス前提
- Docker 実行環境がないと Compose 実起動検証はできない
- 監視通知は別途 Uptime Kuma / Hetzner monitoring / external alerting を追加するとさらに安定する

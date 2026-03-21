# VPS 本番運用マニュアル

## この本番環境の前提

このアプリは、単一の Debian VPS 上で 24時間365日動かす前提です。

- サーバー: `178.104.88.252`
- OS: Debian
- 運用方法: SSH 中心
- 公開方法: IP で公開
- 自動起動: `systemd`
- コンテナ管理: Docker Compose

## サーバーの中で動いているもの

| サービス | 役割 |
| --- | --- |
| `nginx` | 外からの入口 |
| `web` | 画面 |
| `api` | 設定保存、認証、AI相談など |
| `postgres` | データ保存 |

## 最重要ファイル

| ファイル | 役割 |
| --- | --- |
| `/opt/kitchen-app/.env` | 秘密の設定 |
| `/opt/kitchen-app/docker-compose.yml` | サービスの定義 |
| `/opt/kitchen-app/scripts/ops/kitchenctl.sh` | 日常運用コマンド |
| `/etc/systemd/system/kitchen-app.service` | OS起動時の自動起動 |
| `/etc/systemd/system/kitchen-app-backup.timer` | 日次バックアップ |

## 初回起動手順

### 1. サーバーに入る

```bash
ssh aharada@178.104.88.252
```

### 2. アプリの場所に移動する

```bash
cd /opt/kitchen-app
```

### 3. 本番設定を確認する

```bash
nano /opt/kitchen-app/.env
```

最低限必要な項目:

```env
VITE_GOOGLE_CLIENT_ID=必要なら設定
DB_PASSWORD=強いパスワード
JWT_SECRET=長いランダム文字列
JWT_EXPIRES_IN=7d
API_PORT=3001
API_HOST=0.0.0.0
FRONTEND_URL=http://178.104.88.252
TZ=Asia/Tokyo
ENABLE_WEEKLY_EMAIL_JOB=false
NODE_ENV=production
```

注意:

- `DB_PASSWORD` がないと API が DB に入れません
- `JWT_SECRET` がないと API が起動しません
- `.env` は不用意に消さないでください

### 4. スタックを起動する

```bash
bash scripts/ops/kitchenctl.sh up
```

### 5. 状態を確認する

```bash
bash scripts/ops/kitchenctl.sh ps
```

### 6. ヘルスチェックする

```bash
bash scripts/ops/kitchenctl.sh health
```

### 7. ブラウザで開く

```text
http://178.104.88.252
```

## 日常運用コマンド

```bash
bash scripts/ops/kitchenctl.sh ps
bash scripts/ops/kitchenctl.sh logs
bash scripts/ops/kitchenctl.sh logs api
bash scripts/ops/kitchenctl.sh restart
bash scripts/ops/kitchenctl.sh restart api
bash scripts/ops/kitchenctl.sh health
bash scripts/ops/kitchenctl.sh backup-db
bash scripts/ops/kitchenctl.sh prune-backups
```

## systemd 管理

状態確認:

```bash
systemctl status kitchen-app.service
```

再起動:

```bash
sudo systemctl restart kitchen-app.service
```

自動起動確認:

```bash
systemctl is-enabled kitchen-app.service
```

## バックアップ運用

手動バックアップ:

```bash
bash scripts/ops/kitchenctl.sh backup-db
```

復元:

```bash
bash scripts/ops/kitchenctl.sh restore-db backups/ファイル名.sql.gz
```

timer 確認:

```bash
systemctl list-timers | grep kitchen-app
```

## 画面付き運用ツール

### tmux

```bash
ops
```

### lazydocker

```bash
lzd
```

### Cockpit

```bash
ssh -L 9090:127.0.0.1:9090 aharada@178.104.88.252
```

ブラウザ:

```text
https://127.0.0.1:9090
```

### Portainer

```bash
ssh -L 9443:127.0.0.1:9443 aharada@178.104.88.252
```

ブラウザ:

```text
https://127.0.0.1:9443
```

## 障害が起きたときの基本手順

1. `bash scripts/ops/kitchenctl.sh health`
2. `bash scripts/ops/kitchenctl.sh ps`
3. `bash scripts/ops/kitchenctl.sh logs`
4. `bash scripts/ops/kitchenctl.sh logs api`
5. `journalctl -u kitchen-app.service -n 100 --no-pager`

## 覚えるべき大事なこと

1. 困ったら最初に `health`
2. `.env` は消さない
3. バックアップは必ず残す
4. 画面を見るだけならブラウザ
5. 深い調査は `tmux` と `lazydocker`

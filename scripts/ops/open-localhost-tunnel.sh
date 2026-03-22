#!/usr/bin/env bash
set -euo pipefail

LOCAL_PORT="${1:-3000}"
SSH_TARGET="${SSH_TARGET:-aharada@178.104.88.252}"
REMOTE_HOST="${REMOTE_HOST:-127.0.0.1}"
REMOTE_PORT="${REMOTE_PORT:-80}"

cat <<EOF
[kitchen-app tunnel]
local:  http://localhost:${LOCAL_PORT}
remote: ${REMOTE_HOST}:${REMOTE_PORT} via ${SSH_TARGET}

使い方:
1. このまま接続を維持したままにする
2. 別のブラウザで http://localhost:${LOCAL_PORT} を開く
3. Google OAuth の Authorized JavaScript origins に http://localhost:${LOCAL_PORT} を追加する

終了するとき:
  Ctrl+C
EOF

exec ssh \
  -o ExitOnForwardFailure=yes \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -N \
  -L "${LOCAL_PORT}:${REMOTE_HOST}:${REMOTE_PORT}" \
  "${SSH_TARGET}"

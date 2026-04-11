#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_HOST="${REMOTE_HOST:-178.104.88.252}"
REMOTE_PORT="${REMOTE_PORT:-22}"
REMOTE_STAGING_DIR="${REMOTE_STAGING_DIR:-/tmp/kitchen-app-sync}"
REMOTE_TARGET_DIR="${REMOTE_TARGET_DIR:-/opt/kitchen-app}"
SYNC_ONLY="${SYNC_ONLY:-0}"

if ! command -v rsync >/dev/null 2>&1; then
  echo "rsync is required" >&2
  exit 1
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is required" >&2
  exit 1
fi

REMOTE="${REMOTE_USER}@${REMOTE_HOST}"
SSH_OPTS=(-p "${REMOTE_PORT}")
RSYNC_RSH="ssh -p ${REMOTE_PORT}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [--sync-only]

Environment overrides:
  REMOTE_USER         default: ${REMOTE_USER}
  REMOTE_HOST         default: ${REMOTE_HOST}
  REMOTE_PORT         default: ${REMOTE_PORT}
  REMOTE_STAGING_DIR  default: ${REMOTE_STAGING_DIR}
  REMOTE_TARGET_DIR   default: ${REMOTE_TARGET_DIR}
  SYNC_ONLY           set to 1 to skip docker rebuild/restart

This sync keeps the runtime-specific files below untouched on the remote host:
  - .env
  - ssl/
  - backups/
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sync-only)
      SYNC_ONLY=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

remote_exec() {
  ssh "${SSH_OPTS[@]}" "${REMOTE}" "$@"
}

if [[ "${REMOTE_USER}" == "root" ]]; then
  REMOTE_PRIVILEGE_PREFIX=""
else
  REMOTE_PRIVILEGE_PREFIX="sudo "
fi

echo "Preparing remote staging dir: ${REMOTE_STAGING_DIR}"
remote_exec "mkdir -p '${REMOTE_STAGING_DIR}'"

echo "Syncing repo to ${REMOTE}:${REMOTE_STAGING_DIR}"
RSYNC_RSH="${RSYNC_RSH}" rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude 'coverage/' \
  --exclude '.DS_Store' \
  --exclude '.env' \
  --exclude 'ssl/' \
  --exclude 'backups/' \
  --exclude 'apps/discord-bot/test-results/' \
  "${ROOT_DIR}/" "${REMOTE}:${REMOTE_STAGING_DIR}/"

echo "Promoting staging tree into ${REMOTE_TARGET_DIR}"
remote_exec "${REMOTE_PRIVILEGE_PREFIX}mkdir -p '${REMOTE_TARGET_DIR}' && ${REMOTE_PRIVILEGE_PREFIX}rsync -a --delete \
  --filter='P .env' \
  --filter='P ssl/' \
  --filter='P backups/' \
  '${REMOTE_STAGING_DIR}/' '${REMOTE_TARGET_DIR}/'"

if [[ "${SYNC_ONLY}" == "1" ]]; then
  echo "Sync completed without restart"
  exit 0
fi

echo "Rebuilding and restarting runtime"
remote_exec "cd '${REMOTE_TARGET_DIR}' && bash scripts/ops/kitchenctl.sh up"

echo "Running health checks"
remote_exec "cd '${REMOTE_TARGET_DIR}' && bash scripts/ops/kitchenctl.sh health && bash scripts/ops/kitchenctl.sh ps"

echo "Completed sync and restart on ${REMOTE_TARGET_DIR}"

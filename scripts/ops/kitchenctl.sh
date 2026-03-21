#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups}"
PROJECT_NAME="${COMPOSE_PROJECT_NAME:-kitchen-app}"
SSL_DIR="${ROOT_DIR}/ssl"

compose() {
  docker compose \
    --project-name "${PROJECT_NAME}" \
    --env-file "${ENV_FILE}" \
    -f "${ROOT_DIR}/docker-compose.yml" \
    "$@"
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker is required" >&2
    exit 1
  fi
}

usage() {
  cat <<'EOF'
Usage: kitchenctl.sh <command> [args]

Commands:
  up                 Build and start the stack in detached mode
  down               Stop the stack
  build              Build images
  restart [service]  Restart all services or one service
  ps                 Show compose status
  logs [service]     Tail logs for all services or one service
  health             Run container health checks and print status
  backup-db          Create a gzipped PostgreSQL dump under backups/
  prune-backups      Delete local dumps older than BACKUP_RETENTION_DAYS
  restore-db <file>  Restore PostgreSQL from a .sql or .sql.gz dump
  bootstrap-cert     Create a self-signed certificate in ./ssl if none exists
  sync-cert          Copy Let's Encrypt certs into ./ssl and restart nginx
EOF
}

health_check() {
  compose ps
  compose exec -T api node -e "fetch('http://127.0.0.1:3001/api/health').then((res) => res.json().then((body) => { console.log(JSON.stringify(body)); process.exit(res.ok ? 0 : 1) })).catch(() => process.exit(1))"
  compose exec -T web sh -lc "wget -qO- http://127.0.0.1/ >/dev/null"
  compose exec -T nginx sh -lc "wget -qO- http://127.0.0.1/ >/dev/null"
}

backup_db() {
  mkdir -p "${BACKUP_DIR}"
  local timestamp
  timestamp="$(date '+%Y%m%d-%H%M%S')"
  local output="${BACKUP_DIR}/kitchen_app-${timestamp}.sql.gz"
  compose exec -T postgres pg_dump -U kitchen -d kitchen_app | gzip > "${output}"
  echo "Created ${output}"
}

prune_backups() {
  local retention_days="${BACKUP_RETENTION_DAYS:-7}"
  mkdir -p "${BACKUP_DIR}"
  find "${BACKUP_DIR}" -type f -name 'kitchen_app-*.sql.gz' -mtime "+${retention_days}" -delete
  echo "Pruned backups older than ${retention_days} days"
}

restore_db() {
  local input="${1:-}"
  if [[ -z "${input}" || ! -f "${input}" ]]; then
    echo "restore-db requires an existing dump file" >&2
    exit 1
  fi

  if [[ "${input}" == *.gz ]]; then
    gunzip -c "${input}" | compose exec -T postgres psql -U kitchen -d kitchen_app
  else
    compose exec -T postgres psql -U kitchen -d kitchen_app < "${input}"
  fi
}

sync_cert() {
  "${ROOT_DIR}/scripts/ops/sync-letsencrypt.sh"
}

bootstrap_cert() {
  "${ROOT_DIR}/scripts/ops/bootstrap-self-signed-cert.sh"
}

main() {
  local command="${1:-}"
  shift || true

  require_docker

  case "${command}" in
    up)
      if [[ ! -f "${SSL_DIR}/fullchain.pem" || ! -f "${SSL_DIR}/privkey.pem" ]]; then
        bootstrap_cert
      fi
      compose up -d --build
      ;;
    down)
      compose down
      ;;
    build)
      compose build
      ;;
    restart)
      if [[ $# -gt 0 ]]; then
        compose restart "$1"
      else
        compose restart
      fi
      ;;
    ps)
      compose ps
      ;;
    logs)
      if [[ $# -gt 0 ]]; then
        compose logs -f "$1"
      else
        compose logs -f
      fi
      ;;
    health)
      health_check
      ;;
    backup-db)
      backup_db
      ;;
    prune-backups)
      prune_backups
      ;;
    restore-db)
      restore_db "${1:-}"
      ;;
    bootstrap-cert)
      bootstrap_cert
      ;;
    sync-cert)
      sync_cert
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"

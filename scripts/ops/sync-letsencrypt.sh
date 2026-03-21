#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
SSL_DIR="${ROOT_DIR}/ssl"
LETSENCRYPT_LIVE_DIR="${LETSENCRYPT_LIVE_DIR:-/etc/letsencrypt/live}"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

APP_DOMAIN="${APP_DOMAIN:-}"

if [[ -z "${APP_DOMAIN}" ]]; then
  echo "APP_DOMAIN is required in ${ENV_FILE}" >&2
  exit 1
fi

LIVE_DIR="${LETSENCRYPT_LIVE_DIR}/${APP_DOMAIN}"

if [[ ! -f "${LIVE_DIR}/fullchain.pem" || ! -f "${LIVE_DIR}/privkey.pem" ]]; then
  echo "Let's Encrypt files not found under ${LIVE_DIR}" >&2
  exit 1
fi

mkdir -p "${SSL_DIR}"
install -m 0644 "${LIVE_DIR}/fullchain.pem" "${SSL_DIR}/fullchain.pem"
install -m 0600 "${LIVE_DIR}/privkey.pem" "${SSL_DIR}/privkey.pem"

docker compose \
  --project-name "${COMPOSE_PROJECT_NAME:-kitchen-app}" \
  --env-file "${ENV_FILE}" \
  -f "${ROOT_DIR}/docker-compose.yml" \
  restart nginx

echo "Synchronized certificates for ${APP_DOMAIN}"

#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
SSL_DIR="${ROOT_DIR}/ssl"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

APP_DOMAIN="${APP_DOMAIN:-localhost}"

if ! command -v openssl >/dev/null 2>&1; then
  echo "openssl is required to create a bootstrap certificate" >&2
  exit 1
fi

mkdir -p "${SSL_DIR}"

if [[ -f "${SSL_DIR}/fullchain.pem" && -f "${SSL_DIR}/privkey.pem" ]]; then
  echo "Existing certificate found in ${SSL_DIR}; skipping bootstrap"
  exit 0
fi

openssl req \
  -x509 \
  -nodes \
  -newkey rsa:2048 \
  -days 30 \
  -keyout "${SSL_DIR}/privkey.pem" \
  -out "${SSL_DIR}/fullchain.pem" \
  -subj "/CN=${APP_DOMAIN}"

chmod 600 "${SSL_DIR}/privkey.pem"
chmod 644 "${SSL_DIR}/fullchain.pem"

echo "Created self-signed bootstrap certificate for ${APP_DOMAIN} in ${SSL_DIR}"

#!/usr/bin/env bash
# Issue the initial Let's Encrypt certificate for ${DOMAIN}.
#
# Uses certbot --standalone on port 80 (no webroot volume sync issues).
# Requires host port 80 to be free (stop system nginx/apache first).
#
# Usage:
#   bash deploy/scripts/issue-cert.sh
#   bash deploy/scripts/issue-cert.sh --staging

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

ENV_FILE=".env.production"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: ${ENV_FILE} not found. Copy from .env.production.example first." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "${ENV_FILE}"; set +a

: "${DOMAIN:?DOMAIN must be set in ${ENV_FILE}}"
: "${ACME_EMAIL:?ACME_EMAIL must be set in ${ENV_FILE}}"

STAGING_ARG=""
if [[ "${1:-}" == "--staging" ]]; then
  STAGING_ARG="--staging"
  echo "Using Let's Encrypt STAGING environment."
fi

COMPOSE=(docker compose --env-file "${ENV_FILE}" -f docker-compose.prod.yml)

# Free port 80 on the host.
"${COMPOSE[@]}" stop edge 2>/dev/null || true
docker rm -f researchers-acme-bootstrap 2>/dev/null || true

if ss -tln 2>/dev/null | grep -q ':80 '; then
  echo "WARNING: something is still listening on port 80:" >&2
  ss -tln | grep ':80 ' || true
  echo "Stop system nginx/apache as root, then retry:" >&2
  echo "  systemctl stop nginx apache2 httpd" >&2
fi

echo "Requesting certificate for ${DOMAIN} and www.${DOMAIN} (standalone on :80)..."
"${COMPOSE[@]}" run --rm \
  -p 80:80 \
  --entrypoint "" \
  certbot \
  certbot certonly --standalone \
    --preferred-challenges http \
    --http-01-port 80 \
    --email "${ACME_EMAIL}" \
    --agree-tos --no-eff-email \
    -d "${DOMAIN}" -d "www.${DOMAIN}" \
    ${STAGING_ARG}

echo "Bringing up full stack with HTTPS..."
"${COMPOSE[@]}" up -d

echo "Done. Certificate issued for ${DOMAIN}."
echo "Renewals use webroot via the certbot service in docker-compose.prod.yml."

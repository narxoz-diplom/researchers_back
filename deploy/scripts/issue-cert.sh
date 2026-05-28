#!/usr/bin/env bash
# Issue the initial Let's Encrypt certificate for ${DOMAIN}.
# Solves the chicken-and-egg problem: edge nginx needs the cert to start, the
# cert needs HTTP-01 challenge to be served. We spin up a temporary HTTP-only
# nginx that serves /var/www/certbot, obtain the cert, then bring up the full
# stack with HTTPS.
#
# Run from the project root on the VPS, after .env.production is filled.
#
# Usage:
#   bash deploy/scripts/issue-cert.sh
#   bash deploy/scripts/issue-cert.sh --staging   # dry-run against LE staging

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

COMPOSE="docker compose --env-file ${ENV_FILE} -f docker-compose.prod.yml"

# Stop edge to free port 80.
${COMPOSE} stop edge 2>/dev/null || true

# Make sure named volumes exist by touching the certbot service (no-op pull/run).
docker volume create researchers_back_letsencrypt >/dev/null 2>&1 || true
docker volume create researchers_back_certbot_www >/dev/null 2>&1 || true

NETWORK_NAME="$(${COMPOSE} config --format json 2>/dev/null \
  | grep -oE '"researchers_back_internal"|"internal"' | head -1 | tr -d '"' || true)"

echo "Starting temporary ACME nginx on port 80..."
docker rm -f researchers-acme-bootstrap >/dev/null 2>&1 || true
docker run -d --name researchers-acme-bootstrap \
  -p 80:80 \
  -v "$(docker volume ls -q | grep certbot_www | head -1):/var/www/certbot:ro" \
  nginx:1.27-alpine \
  sh -c "printf 'server { listen 80; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 404; } }' > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"

cleanup() {
  docker rm -f researchers-acme-bootstrap >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Waiting for bootstrap nginx..."
sleep 3

echo "Requesting certificate for ${DOMAIN} and www.${DOMAIN}..."
${COMPOSE} run --rm --entrypoint "" certbot \
  certbot certonly --webroot \
    --webroot-path /var/www/certbot \
    --email "${ACME_EMAIL}" \
    --agree-tos --no-eff-email \
    -d "${DOMAIN}" -d "www.${DOMAIN}" \
    ${STAGING_ARG}

cleanup
trap - EXIT

echo "Bringing up full stack with HTTPS..."
${COMPOSE} up -d

echo "Done. Certificate issued for ${DOMAIN}."
echo "Renewals are handled by the 'certbot' service in the compose file."

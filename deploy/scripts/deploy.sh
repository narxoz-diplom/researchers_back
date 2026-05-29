#!/usr/bin/env bash
# Idempotent deploy. Run as the deploy user on the VPS, or via SSH from CI.
#
# Reads tags from CLI args or env, pulls images from GHCR, runs prisma migrate
# deploy, recreates services, and verifies health. Old API tag is saved to
# .last-api-tag so rollback.sh can restore it.
#
# Usage:
#   deploy.sh                                   # use API_IMAGE_TAG / WEB_IMAGE_TAG from .env.production
#   deploy.sh <api-tag> <web-tag>               # explicit
#   API_IMAGE_TAG=sha-abc deploy.sh             # via env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

ENV_FILE=".env.production"
[[ -f "${ENV_FILE}" ]] || { echo "ERROR: ${ENV_FILE} missing" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; source "${ENV_FILE}"; set +a

# GitHub Actions sets IMAGE_OWNER from repository_owner (org slug). Overrides .env
# when the VPS file still has a personal username (e.g. zhubanyshzh vs narxoz-diplom).
if [[ -n "${CI_IMAGE_OWNER:-}" ]]; then
  IMAGE_OWNER="${CI_IMAGE_OWNER}"
fi

NEW_API_TAG="${1:-${API_IMAGE_TAG:-latest}}"
NEW_WEB_TAG="${2:-${WEB_IMAGE_TAG:-latest}}"

: "${IMAGE_OWNER:?IMAGE_OWNER must be set in ${ENV_FILE}}"
: "${DOMAIN:?DOMAIN must be set in ${ENV_FILE}}"

COMPOSE=(docker compose --env-file "${ENV_FILE}" -f docker-compose.prod.yml)

PREV_API_TAG="$(cat .last-api-tag 2>/dev/null || echo "")"
PREV_WEB_TAG="$(cat .last-web-tag 2>/dev/null || echo "")"

echo "==> Deploying api=${NEW_API_TAG} web=${NEW_WEB_TAG}"
echo "    previous: api=${PREV_API_TAG:-none} web=${PREV_WEB_TAG:-none}"

API_IMAGE_TAG="${NEW_API_TAG}" \
WEB_IMAGE_TAG="${NEW_WEB_TAG}" \
  "${COMPOSE[@]}" pull api web migrate

echo "==> Running database migrations"
API_IMAGE_TAG="${NEW_API_TAG}" \
WEB_IMAGE_TAG="${NEW_WEB_TAG}" \
  "${COMPOSE[@]}" run --rm migrate

echo "==> Starting / updating stack"
API_IMAGE_TAG="${NEW_API_TAG}" \
WEB_IMAGE_TAG="${NEW_WEB_TAG}" \
  "${COMPOSE[@]}" up -d --remove-orphans

# Edge renders nginx from host-mounted templates at container start; recreate so
# deploy/nginx changes (e.g. proxy keepalive) apply without a manual step.
API_IMAGE_TAG="${NEW_API_TAG}" \
WEB_IMAGE_TAG="${NEW_WEB_TAG}" \
  "${COMPOSE[@]}" up -d --force-recreate edge

echo "==> Waiting for API healthcheck (inside container)"
healthy=0
for i in $(seq 1 45); do
  if API_IMAGE_TAG="${NEW_API_TAG}" WEB_IMAGE_TAG="${NEW_WEB_TAG}" \
    "${COMPOSE[@]}" exec -T api curl -fsS http://127.0.0.1:8080/api/v1/health >/dev/null 2>&1; then
    echo "    API healthy (internal, attempt ${i})"
    healthy=1
    break
  fi
  sleep 2
done

if [[ "${healthy}" -ne 1 ]]; then
  echo "ERROR: API did not become healthy in time" >&2
  "${COMPOSE[@]}" logs --tail=80 api edge || true
  exit 1
fi

if curl -fsS "https://${DOMAIN}/api/v1/health" >/dev/null 2>&1 \
  || curl -fsSk "https://${DOMAIN}/api/v1/health" >/dev/null 2>&1; then
  echo "    Public HTTPS healthcheck OK"
else
  echo "WARNING: internal API is up but https://${DOMAIN}/api/v1/health failed from host" >&2
  echo "         (often staging TLS cert or edge still restarting — verify in browser)" >&2
fi

echo "==> Pruning unused docker images"
docker image prune -f >/dev/null || true

echo "${NEW_API_TAG}" > .last-api-tag
echo "${NEW_WEB_TAG}" > .last-web-tag
if [[ -n "${PREV_API_TAG}" ]]; then echo "${PREV_API_TAG}" > .prev-api-tag; fi
if [[ -n "${PREV_WEB_TAG}" ]]; then echo "${PREV_WEB_TAG}" > .prev-web-tag; fi

echo "==> Deploy OK: api=${NEW_API_TAG} web=${NEW_WEB_TAG}"

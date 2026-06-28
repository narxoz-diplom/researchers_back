#!/usr/bin/env bash
# Idempotent deploy. Run as the deploy user on the VPS, or via SSH from CI.
#
# Reads tags from CLI args or env, pulls images from GHCR, runs prisma migrate
# deploy, recreates services, and verifies health. Old API tag is saved to
# .last-api-tag so rollback.sh can restore it.
#
# Usage:
#   deploy.sh                                   # use API_IMAGE_TAG / WEB_IMAGE_TAG / RAG_IMAGE_TAG from .env.production
#   deploy.sh <api-tag> <web-tag>               # explicit api + web
#   deploy.sh <api-tag> <web-tag> <rag-tag>     # explicit all three
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

PREV_RAG_TAG="$(cat .last-rag-tag 2>/dev/null || echo "")"

# RAG tag: explicit CLI arg > env > last successful deploy > latest
if [[ -n "${3:-}" ]]; then
  NEW_RAG_TAG="$3"
elif [[ -n "${RAG_IMAGE_TAG:-}" ]]; then
  NEW_RAG_TAG="${RAG_IMAGE_TAG}"
elif [[ -n "${PREV_RAG_TAG}" ]]; then
  NEW_RAG_TAG="${PREV_RAG_TAG}"
else
  NEW_RAG_TAG="latest"
fi

: "${IMAGE_OWNER:?IMAGE_OWNER must be set in ${ENV_FILE}}"
: "${DOMAIN:?DOMAIN must be set in ${ENV_FILE}}"

COMPOSE=(docker compose --env-file "${ENV_FILE}" -f docker-compose.prod.yml)

PREV_API_TAG="$(cat .last-api-tag 2>/dev/null || echo "")"
PREV_WEB_TAG="$(cat .last-web-tag 2>/dev/null || echo "")"

compose_migrate() {
  API_IMAGE_TAG="${NEW_API_TAG}" \
  WEB_IMAGE_TAG="${NEW_WEB_TAG}" \
  RAG_IMAGE_TAG="${NEW_RAG_TAG}" \
    "${COMPOSE[@]}" run --rm migrate "$@"
}

recover_failed_prisma_migrations() {
  local status
  status="$(compose_migrate npx prisma migrate status 2>&1)" || true
  if ! echo "${status}" | grep -qi 'failed'; then
    return 0
  fi
  echo "==> Failed Prisma migrations detected, attempting safe recovery"
  # One-time prod recovery: SQL fix is idempotent (ADD COLUMN IF NOT EXISTS).
  if echo "${status}" | grep -q '20250623120000_course_section_categories'; then
    echo "    resolve --rolled-back 20250623120000_course_section_categories"
    compose_migrate npx prisma migrate resolve --rolled-back 20250623120000_course_section_categories
  fi
}

echo "==> Deploying api=${NEW_API_TAG} web=${NEW_WEB_TAG} rag=${NEW_RAG_TAG}"
echo "    previous: api=${PREV_API_TAG:-none} web=${PREV_WEB_TAG:-none} rag=${PREV_RAG_TAG:-none}"

RAG_IMAGE="ghcr.io/${IMAGE_OWNER}/rag-service:${NEW_RAG_TAG}"
if [[ -x "${SCRIPT_DIR}/verify-ghcr-rag.sh" ]]; then
  if ! bash "${SCRIPT_DIR}/verify-ghcr-rag.sh" "${RAG_IMAGE}" 2>/dev/null; then
    if [[ "${NEW_RAG_TAG}" != "latest" ]] || [[ -z "${PREV_RAG_TAG}" ]] || [[ "${PREV_RAG_TAG}" == "latest" ]]; then
      bash "${SCRIPT_DIR}/verify-ghcr-rag.sh" "${RAG_IMAGE}"
    else
      echo "    WARN: rag-service:latest not found, falling back to .last-rag-tag=${PREV_RAG_TAG}" >&2
      NEW_RAG_TAG="${PREV_RAG_TAG}"
      RAG_IMAGE="ghcr.io/${IMAGE_OWNER}/rag-service:${NEW_RAG_TAG}"
      bash "${SCRIPT_DIR}/verify-ghcr-rag.sh" "${RAG_IMAGE}"
    fi
  fi
fi

API_IMAGE_TAG="${NEW_API_TAG}" \
WEB_IMAGE_TAG="${NEW_WEB_TAG}" \
RAG_IMAGE_TAG="${NEW_RAG_TAG}" \
  "${COMPOSE[@]}" pull api web migrate rag chromadb

echo "==> Running database migrations"
recover_failed_prisma_migrations
compose_migrate

echo "==> Starting / updating stack"
API_IMAGE_TAG="${NEW_API_TAG}" \
WEB_IMAGE_TAG="${NEW_WEB_TAG}" \
RAG_IMAGE_TAG="${NEW_RAG_TAG}" \
  "${COMPOSE[@]}" up -d --remove-orphans

# Edge renders nginx from host-mounted templates at container start; recreate so
# deploy/nginx changes (e.g. proxy keepalive) apply without a manual step.
API_IMAGE_TAG="${NEW_API_TAG}" \
WEB_IMAGE_TAG="${NEW_WEB_TAG}" \
RAG_IMAGE_TAG="${NEW_RAG_TAG}" \
  "${COMPOSE[@]}" up -d --force-recreate edge

echo "==> Waiting for API healthcheck (inside container)"
healthy=0
for i in $(seq 1 45); do
  if API_IMAGE_TAG="${NEW_API_TAG}" WEB_IMAGE_TAG="${NEW_WEB_TAG}" RAG_IMAGE_TAG="${NEW_RAG_TAG}" \
    "${COMPOSE[@]}" exec -T api curl -fsS http://127.0.0.1:8080/api/v1/health >/dev/null 2>&1; then
    echo "    API healthy (internal, attempt ${i})"
    healthy=1
    break
  fi
  sleep 2
done

if [[ "${healthy}" -ne 1 ]]; then
  echo "ERROR: API did not become healthy in time" >&2
  "${COMPOSE[@]}" logs --tail=80 api rag edge || true
  exit 1
fi

echo "==> Waiting for RAG healthcheck (inside container)"
rag_healthy=0
for i in $(seq 1 45); do
  if API_IMAGE_TAG="${NEW_API_TAG}" WEB_IMAGE_TAG="${NEW_WEB_TAG}" RAG_IMAGE_TAG="${NEW_RAG_TAG}" \
    "${COMPOSE[@]}" exec -T rag curl -fsS http://127.0.0.1:8000/api/v1/health >/dev/null 2>&1; then
    echo "    RAG healthy (internal, attempt ${i})"
    rag_healthy=1
    break
  fi
  sleep 2
done

if [[ "${rag_healthy}" -ne 1 ]]; then
  echo "WARNING: RAG did not become healthy in time (AI features may be unavailable)" >&2
  "${COMPOSE[@]}" logs --tail=80 rag chromadb || true
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
echo "${NEW_RAG_TAG}" > .last-rag-tag
if [[ -n "${PREV_API_TAG}" ]]; then echo "${PREV_API_TAG}" > .prev-api-tag; fi
if [[ -n "${PREV_WEB_TAG}" ]]; then echo "${PREV_WEB_TAG}" > .prev-web-tag; fi
if [[ -n "${PREV_RAG_TAG}" ]]; then echo "${PREV_RAG_TAG}" > .prev-rag-tag; fi

echo "==> Deploy OK: api=${NEW_API_TAG} web=${NEW_WEB_TAG} rag=${NEW_RAG_TAG}"

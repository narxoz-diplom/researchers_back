#!/usr/bin/env bash
# One-time prod recovery when Course.category is missing and migrate image is stale.
# Applies SQL directly in Postgres, marks migration applied, runs remaining migrations.
#
# Usage (on VPS, from ~/researchers):
#   API_IMAGE_TAG=sha-c2625cfd495a bash deploy/scripts/migrate-fix-category-column.sh
#
# API_IMAGE_TAG must be a researchers-api image that includes migrations after
# 20250623120000 (landing_sections, AI tables, etc.).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

ENV_FILE=".env.production"
[[ -f "${ENV_FILE}" ]] || { echo "ERROR: ${ENV_FILE} missing (run from ~/researchers)" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; source "${ENV_FILE}"; set +a

: "${POSTGRES_USER:?POSTGRES_USER required in ${ENV_FILE}}"
: "${POSTGRES_DB:?POSTGRES_DB required in ${ENV_FILE}}"
: "${API_IMAGE_TAG:?Set API_IMAGE_TAG to a recent researchers-api sha from GitHub Actions}"

COMPOSE=(docker compose --env-file "${ENV_FILE}" -f docker-compose.prod.yml)

compose_migrate() {
  API_IMAGE_TAG="${API_IMAGE_TAG}" \
  WEB_IMAGE_TAG="${WEB_IMAGE_TAG:-latest}" \
  RAG_IMAGE_TAG="${RAG_IMAGE_TAG:-latest}" \
    "${COMPOSE[@]}" run --rm migrate "$@"
}

echo "==> Pulling migrate image researchers-api:${API_IMAGE_TAG}"
API_IMAGE_TAG="${API_IMAGE_TAG}" \
WEB_IMAGE_TAG="${WEB_IMAGE_TAG:-latest}" \
RAG_IMAGE_TAG="${RAG_IMAGE_TAG:-latest}" \
  "${COMPOSE[@]}" pull migrate

echo "==> Applying category column + index directly in Postgres"
"${COMPOSE[@]}" exec -T postgres psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" <<'SQL'
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'publication';

UPDATE "Course" SET "category" = 'publication'
WHERE "category" IN ('General', 'Академическое письмо', '') OR "category" IS NULL;

UPDATE "Course" SET "category" = 'methods'
WHERE "category" ILIKE '%метод%';

UPDATE "Course" SET "category" = 'publication'
WHERE "category" NOT IN ('publication', 'methods', 'tools', 'wellness');

ALTER TABLE "Course" ALTER COLUMN "category" SET DEFAULT 'publication';

CREATE INDEX IF NOT EXISTS "Course_status_category_idx" ON "Course"("status", "category");
SQL

echo "==> Clearing failed migration state (if any)"
compose_migrate npx prisma migrate resolve --rolled-back 20250623120000_course_section_categories 2>/dev/null || true

echo "==> Marking 20250623120000_course_section_categories as applied"
compose_migrate npx prisma migrate resolve --applied 20250623120000_course_section_categories

echo "==> Deploying remaining migrations"
compose_migrate npx prisma migrate deploy

echo "==> Done. Re-run GitHub Actions deploy or: bash deploy/scripts/deploy.sh"

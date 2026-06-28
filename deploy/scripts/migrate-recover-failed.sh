#!/usr/bin/env bash
# Mark a failed Prisma migration as rolled back so migrate deploy can retry it.
# Run once on the VPS after fixing migration SQL in git and pulling a new api image.
#
# Usage:
#   bash deploy/scripts/migrate-recover-failed.sh
#   bash deploy/scripts/migrate-recover-failed.sh 20250623120000_course_section_categories

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

ENV_FILE=".env.production"
[[ -f "${ENV_FILE}" ]] || { echo "ERROR: ${ENV_FILE} missing" >&2; exit 1; }

MIGRATION_NAME="${1:-20250623120000_course_section_categories}"

COMPOSE=(docker compose --env-file "${ENV_FILE}" -f docker-compose.prod.yml)

echo "==> Prisma migrate status (before recovery)"
"${COMPOSE[@]}" run --rm migrate npx prisma migrate status || true

echo "==> Marking failed migration as rolled back: ${MIGRATION_NAME}"
"${COMPOSE[@]}" run --rm migrate \
  npx prisma migrate resolve --rolled-back "${MIGRATION_NAME}"

echo "==> Applying migrations"
"${COMPOSE[@]}" run --rm migrate npx prisma migrate deploy

echo "==> Done. Re-run deploy.sh or GitHub Actions deploy job."

#!/usr/bin/env bash
# Encrypted PostgreSQL backup using pg_dump | zstd | age.
# Output: /backups/researchers-YYYYMMDD-HHMMSS.sql.zst.age
# Retention: keeps last $BACKUP_RETENTION_DAYS daily files.

set -euo pipefail

: "${POSTGRES_HOST:?}"
: "${POSTGRES_PORT:?}"
: "${POSTGRES_USER:?}"
: "${POSTGRES_PASSWORD:?}"
: "${POSTGRES_DB:?}"
: "${BACKUP_AGE_RECIPIENT:?}"

TS="$(date -u +%Y%m%d-%H%M%S)"
OUT="/backups/researchers-${TS}.sql.zst.age"
TMP="${OUT}.tmp"

export PGPASSWORD="${POSTGRES_PASSWORD}"

echo "[$(date -u +%FT%TZ)] start backup -> ${OUT}"

pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --no-owner --no-privileges --format=plain \
  | zstd -19 -q \
  | age -r "${BACKUP_AGE_RECIPIENT}" -o "${TMP}"

mv "${TMP}" "${OUT}"
chmod 600 "${OUT}"

SIZE="$(stat -c %s "${OUT}" 2>/dev/null || stat -f %z "${OUT}")"
echo "[$(date -u +%FT%TZ)] OK ${OUT} (${SIZE} bytes)"

RETENTION="${BACKUP_RETENTION_DAYS:-14}"
echo "[$(date -u +%FT%TZ)] pruning files older than ${RETENTION} days"
find /backups -maxdepth 1 -type f -name 'researchers-*.sql.zst.age' \
  -mtime "+${RETENTION}" -print -delete || true

ln -sf "${OUT}" /backups/latest.sql.zst.age

echo "[$(date -u +%FT%TZ)] done"

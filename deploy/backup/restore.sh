#!/usr/bin/env bash
# Decrypt + restore a backup file produced by backup.sh.
# Run inside the backup container; requires the age IDENTITY (private key)
# mounted at /run/secrets/age-identity.txt.
#
# Usage (from host):
#   docker compose -f docker-compose.prod.yml run --rm \
#     -v /secure/path/age-identity.txt:/run/secrets/age-identity.txt:ro \
#     backup /usr/local/bin/restore.sh /backups/researchers-YYYYMMDD-HHMMSS.sql.zst.age

set -euo pipefail

FILE="${1:?usage: restore.sh <encrypted-backup-file>}"
IDENT="${AGE_IDENTITY_FILE:-/run/secrets/age-identity.txt}"

[[ -r "${FILE}" ]] || { echo "Cannot read ${FILE}" >&2; exit 1; }
[[ -r "${IDENT}" ]] || { echo "Missing age identity at ${IDENT}" >&2; exit 1; }

: "${POSTGRES_HOST:?}"
: "${POSTGRES_PORT:?}"
: "${POSTGRES_USER:?}"
: "${POSTGRES_PASSWORD:?}"
: "${POSTGRES_DB:?}"

export PGPASSWORD="${POSTGRES_PASSWORD}"

echo "Decrypting ${FILE} and piping into psql ${POSTGRES_DB}..."

age -d -i "${IDENT}" "${FILE}" \
  | zstd -dq \
  | psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" \
         -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
         --set ON_ERROR_STOP=on

echo "Restore done."

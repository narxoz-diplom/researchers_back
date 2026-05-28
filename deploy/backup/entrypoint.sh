#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_CRON:?BACKUP_CRON must be set}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT must be set}"

mkdir -p /backups
chmod 700 /backups

CRONFILE=/etc/crontabs/root
ENVDUMP=/etc/backup.env
{
  printf 'export POSTGRES_HOST=%q\n' "${POSTGRES_HOST}"
  printf 'export POSTGRES_PORT=%q\n' "${POSTGRES_PORT}"
  printf 'export POSTGRES_USER=%q\n' "${POSTGRES_USER}"
  printf 'export POSTGRES_PASSWORD=%q\n' "${POSTGRES_PASSWORD}"
  printf 'export POSTGRES_DB=%q\n' "${POSTGRES_DB}"
  printf 'export BACKUP_RETENTION_DAYS=%q\n' "${BACKUP_RETENTION_DAYS:-14}"
  printf 'export BACKUP_AGE_RECIPIENT=%q\n' "${BACKUP_AGE_RECIPIENT}"
} > "${ENVDUMP}"
chmod 600 "${ENVDUMP}"

echo "${BACKUP_CRON} . ${ENVDUMP}; /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" > "${CRONFILE}"
chmod 600 "${CRONFILE}"

echo "Starting cron. Schedule: ${BACKUP_CRON}"
touch /var/log/backup.log

if [[ "${BACKUP_RUN_ON_START:-false}" == "true" ]]; then
  . "${ENVDUMP}"
  /usr/local/bin/backup.sh || echo "Initial backup failed (continuing)"
fi

crond -f -l 2 &
CRON_PID=$!
tail -F /var/log/backup.log &
trap "kill ${CRON_PID} 2>/dev/null || true" TERM INT
wait ${CRON_PID}

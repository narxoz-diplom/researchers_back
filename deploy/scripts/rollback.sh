#!/usr/bin/env bash
# Roll back to the previously deployed image tags recorded by deploy.sh
# (.prev-api-tag and .prev-web-tag).
#
# Usage:
#   rollback.sh                  # use saved previous tags
#   rollback.sh <api> <web>      # rollback to explicit tags

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

API_TAG="${1:-$(cat .prev-api-tag 2>/dev/null || true)}"
WEB_TAG="${2:-$(cat .prev-web-tag 2>/dev/null || true)}"

if [[ -z "${API_TAG}" || -z "${WEB_TAG}" ]]; then
  echo "ERROR: no previous tags recorded. Pass tags explicitly:" >&2
  echo "  rollback.sh <api-tag> <web-tag>" >&2
  exit 1
fi

echo "==> Rolling back to api=${API_TAG} web=${WEB_TAG}"
exec bash "${SCRIPT_DIR}/deploy.sh" "${API_TAG}" "${WEB_TAG}"

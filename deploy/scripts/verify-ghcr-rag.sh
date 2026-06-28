#!/usr/bin/env bash
# Verify docker can pull the RAG image from GHCR (run on VPS after docker login).
set -euo pipefail

IMAGE="${1:?Usage: verify-ghcr-rag.sh ghcr.io/owner/rag-service:tag}"

if docker manifest inspect "${IMAGE}" >/dev/null 2>&1; then
  echo "OK: ${IMAGE}"
  exit 0
fi

echo "ERROR: cannot pull ${IMAGE} (403/404 after docker login)." >&2
cat >&2 <<'EOF'

Fix (choose one):

  A) Deploy RAG first (creates :latest and sha-* tags):
     Push RAG_service branch researchers → wait for "Deploy RAG" workflow → re-run backend deploy

  B) Pin a tag that exists on GHCR in .env.production on VPS:
     RAG_IMAGE_TAG=sha-86643b84375f

  C) Make the package public (if 403):
     GitHub → Organization narxoz-diplom → Packages → rag-service → Public

  D) On VPS, GHCR_USER must be your GitHub username (not the org slug):
     docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin

Then test:
  docker pull IMAGE
EOF
exit 1

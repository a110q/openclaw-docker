#!/usr/bin/env bash
set -euo pipefail

SOURCE_REF="${OPENCLAW_CLAWSWARM_SOURCE_REF:-main}"
SOURCE_URL="${OPENCLAW_CLAWSWARM_SOURCE_URL:-https://github.com/1Panel-dev/ClawSwarm.git}"
BASE_IMAGE="${OPENCLAW_CLAWSWARM_BASE_IMAGE:-openclaw-clawswarm-base-local:${SOURCE_REF}}"
APP_IMAGE="${OPENCLAW_CLAWSWARM_IMAGE:-openclaw-clawswarm-local:${SOURCE_REF}}"
GIT_CONTEXT="${SOURCE_URL}#${SOURCE_REF}"

printf '\n[1/2] Building ClawSwarm base image: %s\n' "$BASE_IMAGE"
docker build \
  -t "$BASE_IMAGE" \
  -f Dockerfile.base \
  "$GIT_CONTEXT"

printf '\n[2/2] Building ClawSwarm app image: %s\n' "$APP_IMAGE"
docker build \
  --build-arg BASE_IMAGE="$BASE_IMAGE" \
  -t "$APP_IMAGE" \
  "$GIT_CONTEXT"

printf '\nDone. Built images:\n- %s\n- %s\n' "$BASE_IMAGE" "$APP_IMAGE"

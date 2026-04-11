#!/usr/bin/env bash
set -euo pipefail

eval "$(node /opt/openclaw-docker/resolve-network-policy.mjs --format shell)"
exec "$@"

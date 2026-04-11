#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

info() {
  printf '\n==> %s\n' "$1"
}

cd "$PROJECT_DIR"

info "Syncing host data and sandbox runtime config"
"$PROJECT_DIR/scripts/init-data-dir.sh"

info "Recreating gateway"
docker compose up -d --force-recreate openclaw-gateway

cat <<'OUT'

Gateway reload finished.

Useful checks:
- docker compose ps openclaw-gateway
- docker compose logs --tail=100 openclaw-gateway
- http://localhost:18789
OUT

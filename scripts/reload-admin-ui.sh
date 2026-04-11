#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

info() {
  printf '\n==> %s\n' "$1"
}

cd "$PROJECT_DIR"

info "Rebuilding admin UI only (without touching gateway)"
docker compose up -d --build --no-deps openclaw-admin-ui

cat <<'OUT'

Admin UI reload finished.

Open:
- http://localhost:18889/

This command uses `--no-deps`, so `openclaw-gateway` is not restarted together.
OUT

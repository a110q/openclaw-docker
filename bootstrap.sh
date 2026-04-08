#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
ENV_FILE="$PROJECT_DIR/.env"

info() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf '\n[bootstrap] ERROR: %s\n' "$1" >&2
  exit 1
}

require_file() {
  local file="$1"
  local message="$2"
  [ -f "$file" ] || fail "$message"
}

read_env_value() {
  local key="$1"
  awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "$ENV_FILE"
}

require_non_placeholder() {
  local key="$1"
  local value
  value="$(read_env_value "$key")"
  [ -n "$value" ] || fail "Missing required value: $key"
  case "$value" in
    CHANGE_ME_LONG_RANDOM_TOKEN|YOUR_*|cli_xxx)
      fail "The value for $key is still a placeholder. Please edit .env before running bootstrap."
      ;;
  esac
}

run_step() {
  local label="$1"
  shift
  info "$label"
  "$@"
}

require_file "$ENV_FILE" "Missing .env. Run: cp .env.example .env"
require_non_placeholder "OPENCLAW_GATEWAY_TOKEN"
require_non_placeholder "OPENAI_COMPATIBLE_API_KEY"

run_step "Initializing host data directory" "$PROJECT_DIR/scripts/init-data-dir.sh"
run_step "Building sandbox image" "$PROJECT_DIR/scripts/build-sandbox-image.sh"
run_step "Building OpenClaw image" docker compose build
run_step "Starting gateway" docker compose up -d openclaw-gateway

cat <<'OUT'

Bootstrap finished.

Next steps:
- Open: http://localhost:18789
- Check status: docker compose ps
- Follow logs: docker compose logs -f openclaw-gateway
- Gateway status: docker compose run --rm openclaw-cli gateway status

Login modes:
- Mode B (`dangerouslyDisableDeviceAuth=true`): first browser login only needs the Gateway Token.
- Mode A (`token + pairing`): first browser login needs pairing approval. To bootstrap the first admin browser safely, run:
  ./scripts/bootstrap-first-control-ui-admin.sh
OUT

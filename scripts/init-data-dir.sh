#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  . "$PROJECT_DIR/.env"
  set +a
fi

HOST_DATA_ROOT="${OPENCLAW_HOST_DATA_ROOT:-}"

if [ -z "$HOST_DATA_ROOT" ] || [ "$HOST_DATA_ROOT" = "CHANGE_ME_ABSOLUTE_HOST_DATA_ROOT" ]; then
  echo "[init-data-dir] ERROR: OPENCLAW_HOST_DATA_ROOT is not configured." >&2
  echo "Please edit .env first." >&2
  echo "Examples:" >&2
  echo "- macOS:   /Users/yourname/openclaw_data" >&2
  echo "- Linux:   /home/yourname/openclaw_data" >&2
  echo "- Windows: C:/Users/yourname/openclaw_data" >&2
  exit 1
fi
OPENCLAW_DIR="$HOST_DATA_ROOT/openclaw"
CACHE_DIR="$HOST_DATA_ROOT/cache"
LOGS_DIR="$HOST_DATA_ROOT/logs"
CONFIG_SOURCE="$PROJECT_DIR/config/openclaw.json.example"
CONFIG_TARGET="$OPENCLAW_DIR/openclaw.json"
GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-CHANGE_ME_LONG_RANDOM_TOKEN}"
GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"

mkdir -p \
  "$OPENCLAW_DIR/extensions" \
  "$OPENCLAW_DIR/workspace/sandbox" \
  "$OPENCLAW_DIR/workspace/agents/default" \
  "$OPENCLAW_DIR/workspace/agents/backend" \
  "$OPENCLAW_DIR/workspace/agents/frontend" \
  "$OPENCLAW_DIR/agents/default/agent" \
  "$OPENCLAW_DIR/agents/backend/agent" \
  "$OPENCLAW_DIR/agents/frontend/agent" \
  "$CACHE_DIR" \
  "$LOGS_DIR"

if [ ! -f "$CONFIG_TARGET" ]; then
  python3 - "$CONFIG_SOURCE" "$CONFIG_TARGET" "$GATEWAY_TOKEN" "$GATEWAY_PORT" <<'PY'
import json
import pathlib
import sys

source = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])
token = sys.argv[3]
port = sys.argv[4]

config = json.loads(source.read_text(encoding="utf-8"))
config.setdefault("gateway", {}).setdefault("auth", {})["token"] = token
config.setdefault("gateway", {}).setdefault("controlUi", {})["allowedOrigins"] = [
    f"http://localhost:{port}",
    f"http://127.0.0.1:{port}"
]

target.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY
  echo "Created $CONFIG_TARGET"
else
  echo "Config already exists, leaving it untouched: $CONFIG_TARGET"
fi

echo "Initialized host data root at $HOST_DATA_ROOT"

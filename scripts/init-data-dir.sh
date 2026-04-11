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
ADMIN_UI_DIR="$OPENCLAW_DIR/admin-ui"
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
  "$ADMIN_UI_DIR/discovery-results" \
  "$CACHE_DIR" \
  "$LOGS_DIR"

CONFIG_INPUT="$CONFIG_TARGET"
CONFIG_CREATED=0

if [ ! -f "$CONFIG_TARGET" ]; then
  CONFIG_INPUT="$CONFIG_SOURCE"
  CONFIG_CREATED=1
fi

python3 - "$CONFIG_INPUT" "$CONFIG_TARGET" "$GATEWAY_TOKEN" "$GATEWAY_PORT" "$CONFIG_CREATED" <<'PY'
import json
import os
import pathlib
import sys

source = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])
token = sys.argv[3]
port = sys.argv[4]
created = sys.argv[5] == "1"

config = json.loads(source.read_text(encoding="utf-8"))

if created:
    config.setdefault("gateway", {}).setdefault("auth", {})["token"] = token
    config.setdefault("gateway", {}).setdefault("controlUi", {})["allowedOrigins"] = [
        f"http://localhost:{port}",
        f"http://127.0.0.1:{port}",
    ]

sandbox_docker = (
    config.setdefault("agents", {})
    .setdefault("defaults", {})
    .setdefault("sandbox", {})
    .setdefault("docker", {})
)

sandbox_network = os.environ.get("OPENCLAW_SANDBOX_NETWORK", "").strip()
if sandbox_network:
    sandbox_docker["network"] = sandbox_network

sandbox_extra_host = os.environ.get("OPENCLAW_SANDBOX_EXTRA_HOST", "").strip()
if sandbox_extra_host:
    extra_hosts = sandbox_docker.get("extraHosts")
    if isinstance(extra_hosts, list):
        normalized_extra_hosts = [str(item) for item in extra_hosts if str(item).strip()]
    elif extra_hosts:
        normalized_extra_hosts = [str(extra_hosts)]
    else:
        normalized_extra_hosts = []

    if sandbox_extra_host not in normalized_extra_hosts:
        normalized_extra_hosts.append(sandbox_extra_host)

    sandbox_docker["extraHosts"] = normalized_extra_hosts

docker_env = sandbox_docker.get("env")
if isinstance(docker_env, dict):
    normalized_docker_env = {str(key): str(value) for key, value in docker_env.items()}
else:
    normalized_docker_env = {}

for upper, lower in [("HTTP_PROXY", "http_proxy"), ("HTTPS_PROXY", "https_proxy"), ("ALL_PROXY", "all_proxy"), ("NO_PROXY", "no_proxy")]:
    normalized_docker_env.pop(upper, None)
    normalized_docker_env.pop(lower, None)

if normalized_docker_env:
    sandbox_docker["env"] = normalized_docker_env
else:
    sandbox_docker.pop("env", None)

target.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY

python3 - "$ADMIN_UI_DIR" <<'PY'
import json
import pathlib
import sys

admin_dir = pathlib.Path(sys.argv[1])
admin_dir.mkdir(parents=True, exist_ok=True)
(admin_dir / "discovery-results").mkdir(parents=True, exist_ok=True)


def ensure_json(name: str, value):
    path = admin_dir / name
    if not path.exists() or not path.read_text(encoding="utf-8").strip():
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


ensure_json("managed-agents.json", [])
ensure_json("alert-channels.json", [])
ensure_json("alert-rules.json", [])
ensure_json("tasks.json", [])
ensure_json("activity.json", [])
ensure_json("change-sets.json", [])
ensure_json("settings.json", {})
PY

if [ "$CONFIG_CREATED" -eq 1 ]; then
  echo "Created $CONFIG_TARGET"
else
  echo "Synchronized sandbox networking in $CONFIG_TARGET"
fi

echo "Initialized host data root at $HOST_DATA_ROOT"

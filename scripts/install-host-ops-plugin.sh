#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo ".env not found" >&2
  exit 1
fi

HOST_DATA_ROOT=$(awk -F= '/^OPENCLAW_HOST_DATA_ROOT=/{print $2}' .env)
if [[ -z "$HOST_DATA_ROOT" ]]; then
  echo "OPENCLAW_HOST_DATA_ROOT is empty in .env" >&2
  exit 1
fi

PLUGIN_SRC="$ROOT_DIR/plugins/openclaw-host-ops"
PLUGIN_DST="$HOST_DATA_ROOT/openclaw/local-plugins/host-ops"
CONFIG_PATH="$HOST_DATA_ROOT/openclaw/openclaw.json"

mkdir -p "$PLUGIN_DST"
rsync -a --delete "$PLUGIN_SRC/" "$PLUGIN_DST/"

echo "[host-ops] synced plugin source to $PLUGIN_DST"

export HOST_DATA_ROOT CONFIG_PATH PLUGIN_DST
node <<'NODE'
const fs = require('fs');
const config = JSON.parse(fs.readFileSync(process.env.CONFIG_PATH, 'utf8'));
config.plugins = config.plugins || {};
config.plugins.load = config.plugins.load || {};
config.plugins.load.paths = Array.isArray(config.plugins.load.paths) ? config.plugins.load.paths : [];
if (!config.plugins.load.paths.includes(process.env.PLUGIN_DST)) {
  config.plugins.load.paths.push(process.env.PLUGIN_DST);
}
config.plugins.entries = config.plugins.entries || {};
config.plugins.entries['host-ops'] = { ...(config.plugins.entries['host-ops'] || {}), enabled: true };
config.plugins.entries.acpx = config.plugins.entries.acpx || {};
config.plugins.entries.acpx.enabled = true;
config.plugins.entries.acpx.config = config.plugins.entries.acpx.config || {};
config.plugins.entries.acpx.config.pluginToolsMcpBridge = true;
fs.writeFileSync(process.env.CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
NODE

echo "[host-ops] restarting gateway"
docker compose restart openclaw-gateway >/dev/null

echo "[host-ops] done"

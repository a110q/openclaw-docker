#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if [[ ! -f .env ]]; then
  echo ".env not found" >&2
  exit 1
fi

set -a
source ./.env
set +a

HOST_DATA_ROOT="${OPENCLAW_HOST_DATA_ROOT:-}"
if [[ -z "$HOST_DATA_ROOT" ]]; then
  echo "OPENCLAW_HOST_DATA_ROOT is empty in .env" >&2
  exit 1
fi

PLUGIN_VERSION="${OPENCLAW_CLAWSWARM_PLUGIN_VERSION:-1.0.5}"
PLUGIN_PACKAGE="@1panel-dev/clawswarm@${PLUGIN_VERSION}"
PLUGIN_DST="$HOST_DATA_ROOT/openclaw/local-plugins/clawswarm"
CONFIG_PATH="$HOST_DATA_ROOT/openclaw/openclaw.json"
CLAWSWARM_INTERNAL_URL="${OPENCLAW_CLAWSWARM_INTERNAL_URL:-http://openclaw-clawswarm:18080}"

mkdir -p "$PLUGIN_DST"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

pushd "$TMP_DIR" >/dev/null
npm pack "$PLUGIN_PACKAGE" >/dev/null
TARBALL=$(ls -1 ./*.tgz | head -n 1)
tar -xzf "$TARBALL"
rm -rf "$PLUGIN_DST"
mkdir -p "$PLUGIN_DST"
cp -R package/. "$PLUGIN_DST/"
popd >/dev/null

echo "[clawswarm] installed $PLUGIN_PACKAGE to $PLUGIN_DST"

export CONFIG_PATH PLUGIN_DST CLAWSWARM_INTERNAL_URL
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
config.plugins.entries.clawswarm = {
  ...(config.plugins.entries.clawswarm || {}),
  enabled: true,
};
config.channels = config.channels || {};
config.channels.clawswarm = config.channels.clawswarm || {};
config.channels.clawswarm.accounts = config.channels.clawswarm.accounts || {};
const account = config.channels.clawswarm.accounts.default || {};
config.channels.clawswarm.accounts.default = {
  ...account,
  enabled: account.enabled !== false,
  baseUrl: typeof account.baseUrl === 'string' && account.baseUrl.trim()
    ? account.baseUrl
    : process.env.CLAWSWARM_INTERNAL_URL,
  webchatMirror: {
    includeIntermediateMessages:
      account.webchatMirror && typeof account.webchatMirror.includeIntermediateMessages === 'boolean'
        ? account.webchatMirror.includeIntermediateMessages
        : true,
  },
};
fs.writeFileSync(process.env.CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
NODE

echo "[clawswarm] restarting gateway"
docker compose restart openclaw-gateway >/dev/null
sleep 3

echo "[clawswarm] verifying plugin route"
/usr/bin/curl -fsS --max-time 8 http://127.0.0.1:${OPENCLAW_GATEWAY_PORT:-18789}/clawswarm/v1/health

echo "[clawswarm] done"

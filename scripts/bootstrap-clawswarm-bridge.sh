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

CONFIG_PATH="$HOST_DATA_ROOT/openclaw/openclaw.json"
CLAWSWARM_BASE_URL="${OPENCLAW_CLAWSWARM_INTERNAL_URL:-http://openclaw-clawswarm:18080}"
CLAWSWARM_PUBLIC_URL="${OPENCLAW_CLAWSWARM_PUBLIC_URL:-http://localhost:18080}"
CLAWSWARM_API_URL="${OPENCLAW_CLAWSWARM_API_URL:-${OPENCLAW_CLAWSWARM_PUBLIC_URL:-http://localhost:18080}}"
CLAWSWARM_USERNAME="${OPENCLAW_CLAWSWARM_USERNAME:-admin}"
CLAWSWARM_PASSWORD="${OPENCLAW_CLAWSWARM_PASSWORD:-admin123456}"
CHANNEL_BASE_URL="${OPENCLAW_CLAWSWARM_CHANNEL_BASE_URL:-http://openclaw-gateway:18789}"
CHANNEL_ACCOUNT_ID="${OPENCLAW_CLAWSWARM_CHANNEL_ACCOUNT_ID:-default}"
INSTANCE_NAME="${OPENCLAW_CLAWSWARM_INSTANCE_NAME:-OpenClaw Gateway}"
SNAPSHOT_PATH="$HOST_DATA_ROOT/openclaw/admin-ui/clawswarm-bridge.json"
GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
mkdir -p "$(dirname "$SNAPSHOT_PATH")"

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-90}"
  for i in $(seq 1 "$attempts"); do
    if /usr/bin/curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      echo "[clawswarm-bridge] $label ready in ${i}s"
      return 0
    fi
    sleep 1
  done

  echo "[clawswarm-bridge] $label not ready: $url" >&2
  docker compose logs --tail=120 openclaw-gateway >&2 || true
  return 1
}

export CONFIG_PATH CLAWSWARM_BASE_URL CLAWSWARM_PUBLIC_URL CLAWSWARM_API_URL CLAWSWARM_USERNAME CLAWSWARM_PASSWORD CHANNEL_BASE_URL CHANNEL_ACCOUNT_ID INSTANCE_NAME SNAPSHOT_PATH

INSTANCE_ID=$(node <<'NODE'
const fs = require('fs');

const configPath = process.env.CONFIG_PATH;
const clawswarmBaseUrl = process.env.CLAWSWARM_BASE_URL.replace(/\/+$/, '');
const clawswarmPublicUrl = process.env.CLAWSWARM_PUBLIC_URL.replace(/\/+$/, '');
const clawswarmApiUrl = process.env.CLAWSWARM_API_URL.replace(/\/+$/, '');
const username = process.env.CLAWSWARM_USERNAME;
const password = process.env.CLAWSWARM_PASSWORD;
const channelBaseUrl = process.env.CHANNEL_BASE_URL.replace(/\/+$/, '');
const channelAccountId = process.env.CHANNEL_ACCOUNT_ID || 'default';
const instanceName = process.env.INSTANCE_NAME || 'OpenClaw Gateway';
const snapshotPath = process.env.SNAPSHOT_PATH;

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function main() {
  const login = await fetch(`${clawswarmApiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const loginPayload = await login.json().catch(() => ({}));
  const cookie = (login.headers.get('set-cookie') || '').split(';', 1)[0];
  if (!login.ok || !cookie) {
    fail(`ClawSwarm 登录失败: ${JSON.stringify(loginPayload)}`);
  }

  const connect = await fetch(`${clawswarmApiUrl}/api/instances/connect`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie,
    },
    body: JSON.stringify({
      name: instanceName,
      channel_base_url: channelBaseUrl,
      channel_account_id: channelAccountId,
    }),
  });
  const connectPayload = await connect.json().catch(() => ({}));
  if (!connect.ok || !connectPayload?.credentials?.outbound_token || !connectPayload?.credentials?.inbound_signing_secret) {
    fail(`ClawSwarm connect 失败: ${JSON.stringify(connectPayload)}`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.channels = config.channels || {};
  config.channels.clawswarm = config.channels.clawswarm || {};
  config.channels.clawswarm.accounts = config.channels.clawswarm.accounts || {};
  const current = config.channels.clawswarm.accounts.default || {};
  config.channels.clawswarm.accounts.default = {
    ...current,
    enabled: true,
    baseUrl: clawswarmBaseUrl,
    outboundToken: connectPayload.credentials.outbound_token,
    inboundSigningSecret: connectPayload.credentials.inbound_signing_secret,
    webchatMirror: {
      includeIntermediateMessages:
        current.webchatMirror && typeof current.webchatMirror.includeIntermediateMessages === 'boolean'
          ? current.webchatMirror.includeIntermediateMessages
          : true,
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  const snapshot = {
    updatedAt: new Date().toISOString(),
    clawswarmBaseUrl,
    clawswarmPublicUrl,
    clawswarmApiUrl,
    channelBaseUrl,
    channelAccountId,
    instance: connectPayload.instance,
    credentials: connectPayload.credentials,
    importedAgentCount: connectPayload.imported_agent_count ?? 0,
    agentKeys: connectPayload.agent_keys ?? [],
  };
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(String(connectPayload.instance.id));
}

main().catch((error) => fail(error instanceof Error ? error.stack || error.message : String(error)));
NODE
)

echo "[clawswarm-bridge] restarting gateway"
docker compose restart openclaw-gateway >/dev/null

wait_for_url "http://127.0.0.1:${GATEWAY_PORT}/clawswarm/v1/health" "plugin health"
wait_for_url "http://127.0.0.1:${GATEWAY_PORT}/clawswarm/v1/agents" "plugin agents route"

echo "[clawswarm-bridge] syncing agents from scheduler"
export INSTANCE_ID
SYNC_RESULT=$(node <<'NODE'
async function main() {
  const base = (process.env.CLAWSWARM_API_URL || process.env.CLAWSWARM_PUBLIC_URL || 'http://localhost:18080').replace(/\/+$/, '');
  const username = process.env.CLAWSWARM_USERNAME || 'admin';
  const password = process.env.CLAWSWARM_PASSWORD || 'admin123456';
  const instanceId = process.env.INSTANCE_ID;

  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const cookie = (login.headers.get('set-cookie') || '').split(';', 1)[0];
  if (!login.ok || !cookie) {
    const body = await login.text();
    throw new Error(`login failed: ${body}`);
  }

  const sync = await fetch(`${base}/api/instances/${instanceId}/sync-agents`, {
    method: 'POST',
    headers: { cookie },
  });
  const body = await sync.text();
  if (!sync.ok) {
    throw new Error(body);
  }
  console.log(body);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
NODE
)

echo "$SYNC_RESULT"

export SYNC_RESULT
node <<'NODE'
const fs = require('fs');
const snapshotPath = process.env.SNAPSHOT_PATH;
if (!snapshotPath) process.exit(0);
const raw = String(process.env.SYNC_RESULT || '').trim();
if (!raw) process.exit(0);
try {
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  snapshot.lastSyncAt = new Date().toISOString();
  snapshot.lastSyncResult = JSON.parse(raw);
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');
} catch {
  process.exit(0);
}
NODE

echo "[clawswarm-bridge] done"

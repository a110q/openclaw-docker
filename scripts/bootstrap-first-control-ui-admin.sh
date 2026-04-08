#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

TIMEOUT_SECONDS="120"

while [ $# -gt 0 ]; do
  case "$1" in
    --timeout)
      TIMEOUT_SECONDS="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--timeout 120]" >&2
      exit 1
      ;;
  esac
done

cd "$PROJECT_DIR"

CONTAINER_ID="$(docker compose ps -q openclaw-gateway)"

if [ -z "$CONTAINER_ID" ]; then
  echo "[bootstrap-first-control-ui-admin] openclaw-gateway is not running." >&2
  echo "Start it first: docker compose up -d openclaw-gateway" >&2
  exit 1
fi

echo "Waiting up to ${TIMEOUT_SECONDS}s for the first pending Control UI browser request..."
echo "Now open http://localhost:18789 , fill Gateway Token, then click Connect once."

docker compose exec -T openclaw-gateway env TIMEOUT_SECONDS="$TIMEOUT_SECONDS" node --input-type=module - <<'NODE'
import fs from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { t as approveBootstrapDevicePairing } from './dist/device-pairing-eajdmrdw.js';

const timeoutSeconds = Number(process.env.TIMEOUT_SECONDS || '120');
const baseDir = '/home/node/.openclaw';
const pendingPath = `${baseDir}/devices/pending.json`;
const pairedPath = `${baseDir}/devices/paired.json`;
const bootstrapProfile = {
  roles: ['operator'],
  scopes: [
    'operator.admin',
    'operator.approvals',
    'operator.pairing',
    'operator.read',
    'operator.talk.secrets',
    'operator.write'
  ]
};

async function readJson(path) {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8') || '{}');
  } catch {
    return {};
  }
}

function listPairedControlUiDevices(paired) {
  return Object.values(paired).filter((entry) => entry && entry.clientId === 'openclaw-control-ui' && entry.clientMode === 'webchat');
}

function latestPendingControlUiRequest(pending) {
  return Object.entries(pending)
    .filter(([, entry]) => entry && entry.clientId === 'openclaw-control-ui' && entry.clientMode === 'webchat')
    .sort((a, b) => (b[1]?.ts || 0) - (a[1]?.ts || 0))[0];
}

const startedAt = Date.now();

for (;;) {
  const paired = await readJson(pairedPath);
  const pairedControlUi = listPairedControlUiDevices(paired);

  if (pairedControlUi.length > 0) {
    console.error('A Control UI browser device is already paired. This helper is only for the first browser admin bootstrap.');
    process.exit(1);
  }

  const pending = await readJson(pendingPath);
  const latest = latestPendingControlUiRequest(pending);

  if (latest) {
    const [requestId, request] = latest;
    const result = await approveBootstrapDevicePairing(requestId, bootstrapProfile, baseDir);

    if (!result || result.status !== 'approved') {
      console.error(JSON.stringify({ requestId, result }, null, 2));
      process.exit(1);
    }

    console.log(JSON.stringify({
      status: 'approved',
      requestId,
      deviceId: request.deviceId,
      note: 'First Control UI browser admin approved. Refresh the browser and reconnect.'
    }, null, 2));
    process.exit(0);
  }

  if (Date.now() - startedAt > timeoutSeconds * 1000) {
    console.error(`Timed out after ${timeoutSeconds}s waiting for a pending Control UI browser request.`);
    process.exit(1);
  }

  await sleep(1000);
}
NODE

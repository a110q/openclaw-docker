#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import net from 'net';

const proxyKeys = [
  ['HTTP_PROXY', 'http_proxy'],
  ['HTTPS_PROXY', 'https_proxy'],
  ['ALL_PROXY', 'all_proxy'],
  ['NO_PROXY', 'no_proxy']
];

const requiredNoProxyHosts = [
  'localhost',
  '127.0.0.1',
  'host.docker.internal',
  'openclaw-gateway',
  'openclaw-clawswarm',
  'openclaw-admin-ui',
  'openclaw-mysql'
];

function firstNonEmpty(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function normalizeMode(input) {
  const value = String(input || 'auto').trim().toLowerCase();
  if (value === 'direct' || value === 'proxy_only') return value;
  return 'auto';
}

function shellEscape(value) {
  return String(value).replace(/'/g, `'"'"'`);
}

function mergeNoProxyList(rawValue) {
  const existing = String(rawValue || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const next = [];
  for (const entry of [...existing, ...requiredNoProxyHosts]) {
    const normalized = String(entry || '').trim();
    if (!normalized || next.includes(normalized)) continue;
    next.push(normalized);
  }

  return next.join(',');
}

function defaultPortFor(protocol) {
  if (protocol === 'https:') return 443;
  if (protocol === 'socks:' || protocol === 'socks5:' || protocol === 'socks4:' || protocol === 'socks4a:') return 1080;
  return 80;
}

function parseProxyTarget(proxyUrl) {
  const parsed = new URL(proxyUrl);
  return {
    url: proxyUrl,
    protocol: parsed.protocol,
    host: parsed.hostname,
    port: Number(parsed.port || defaultPortFor(parsed.protocol))
  };
}

async function probeProxy(proxyUrl, timeoutMs) {
  try {
    const target = parseProxyTarget(proxyUrl);
    await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: target.host, port: target.port });
      const timer = setTimeout(() => {
        socket.destroy(new Error('timeout'));
      }, timeoutMs);

      socket.unref();
      socket.once('connect', () => {
        clearTimeout(timer);
        socket.destroy();
        resolve();
      });
      socket.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      socket.once('close', () => {
        clearTimeout(timer);
      });
    });
    return { url: proxyUrl, ok: true };
  } catch (error) {
    return {
      url: proxyUrl,
      ok: false,
      error: error instanceof Error ? error.message : 'unknown error'
    };
  }
}

async function patchOpenClawConfig(effective) {
  const hostRoot = process.env.OPENCLAW_HOST_DATA_ROOT?.trim();
  const configPath = hostRoot
    ? path.join(hostRoot, 'openclaw', 'openclaw.json')
    : '/home/node/.openclaw/openclaw.json';

  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(raw);
    const sandboxDocker = config?.agents?.defaults?.sandbox?.docker;
    if (!sandboxDocker || typeof sandboxDocker !== 'object') {
      return { configPath, updated: false, reason: 'sandbox_docker_missing' };
    }

    const dockerEnv = sandboxDocker.env && typeof sandboxDocker.env === 'object'
      ? Object.fromEntries(Object.entries(sandboxDocker.env).map(([key, value]) => [String(key), String(value)]))
      : {};

    for (const [upper, lower] of proxyKeys) {
      delete dockerEnv[upper];
      delete dockerEnv[lower];
    }

    const nextValues = {
      HTTP_PROXY: effective.HTTP_PROXY,
      HTTPS_PROXY: effective.HTTPS_PROXY,
      ALL_PROXY: effective.ALL_PROXY,
      NO_PROXY: effective.NO_PROXY
    };

    for (const [upper, lower] of proxyKeys) {
      const value = nextValues[upper];
      if (!value) continue;
      dockerEnv[upper] = value;
      dockerEnv[lower] = value;
    }

    if (Object.keys(dockerEnv).length) {
      sandboxDocker.env = dockerEnv;
    } else {
      delete sandboxDocker.env;
    }

    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    return { configPath, updated: true, reason: 'ok' };
  } catch (error) {
    return {
      configPath,
      updated: false,
      reason: error instanceof Error ? error.message : 'unknown error'
    };
  }
}

async function writeStatusFile(payload) {
  const hostRoot = process.env.OPENCLAW_HOST_DATA_ROOT?.trim();
  if (!hostRoot) return null;
  const statusPath = path.join(hostRoot, 'openclaw', 'admin-ui', 'network-policy.json');
  await fs.mkdir(path.dirname(statusPath), { recursive: true });
  await fs.writeFile(statusPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return statusPath;
}

const mode = normalizeMode(process.env.OPENCLAW_PROXY_MODE);
const timeoutMs = Number(process.env.OPENCLAW_PROXY_PROBE_TIMEOUT_MS || '1500') || 1500;
const configured = {
  HTTP_PROXY: firstNonEmpty('OPENCLAW_PROXY_HTTP_URL', 'HTTP_PROXY', 'http_proxy'),
  HTTPS_PROXY: firstNonEmpty('OPENCLAW_PROXY_HTTPS_URL', 'HTTPS_PROXY', 'https_proxy') || firstNonEmpty('OPENCLAW_PROXY_HTTP_URL', 'HTTP_PROXY', 'http_proxy'),
  ALL_PROXY: firstNonEmpty('OPENCLAW_PROXY_ALL_URL', 'ALL_PROXY', 'all_proxy'),
  NO_PROXY: mergeNoProxyList(firstNonEmpty('OPENCLAW_PROXY_NO_PROXY', 'NO_PROXY', 'no_proxy', 'OPENCLAW_PROXY_BYPASS'))
};

const probeCandidates = [...new Set([configured.HTTP_PROXY, configured.HTTPS_PROXY, configured.ALL_PROXY].filter(Boolean))];
const probes = [];
let effective = { HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', NO_PROXY: '' };
let decision = 'direct';
let reason = 'no_proxy_configured';
let fatalMessage = '';

if (mode === 'direct') {
  reason = 'mode_direct';
} else if (!probeCandidates.length) {
  reason = 'no_proxy_configured';
} else {
  for (const candidate of probeCandidates) {
    probes.push(await probeProxy(candidate, timeoutMs));
  }

  const failedProbe = probes.find((item) => !item.ok);
  if (!failedProbe) {
    effective = { ...configured };
    decision = 'proxy';
    reason = 'proxy_reachable';
  } else if (mode === 'proxy_only') {
    decision = 'proxy_only_failed';
    reason = 'proxy_unreachable';
    fatalMessage = `${failedProbe.url} -> ${failedProbe.error || 'unreachable'}`;
  } else {
    decision = 'direct';
    reason = 'auto_fallback_direct';
  }
}

const configPatch = await patchOpenClawConfig(effective);
const statusPayload = {
  updatedAt: new Date().toISOString(),
  mode,
  decision,
  reason,
  configured,
  effective,
  probes,
  configPatch,
  fatalMessage: fatalMessage || undefined
};
const statusPath = await writeStatusFile(statusPayload);

const summary = `[proxy-policy] mode=${mode} decision=${decision} reason=${reason}` + (fatalMessage ? ` detail=${fatalMessage}` : '');
console.error(summary);
if (statusPath) {
  console.error(`[proxy-policy] status-file=${statusPath}`);
}

if (process.argv.includes('--format') && process.argv[process.argv.indexOf('--format') + 1] === 'shell') {
  const lines = [];
  const exports = {
    HTTP_PROXY: effective.HTTP_PROXY,
    HTTPS_PROXY: effective.HTTPS_PROXY,
    ALL_PROXY: effective.ALL_PROXY,
    NO_PROXY: effective.NO_PROXY,
    http_proxy: effective.HTTP_PROXY,
    https_proxy: effective.HTTPS_PROXY,
    all_proxy: effective.ALL_PROXY,
    no_proxy: effective.NO_PROXY,
    OPENCLAW_EFFECTIVE_PROXY_MODE: decision === 'proxy' ? 'proxy' : 'direct',
    OPENCLAW_EFFECTIVE_PROXY_REASON: reason
  };

  for (const [key, value] of Object.entries(exports)) {
    if (value) {
      lines.push(`export ${key}='${shellEscape(value)}'`);
    } else {
      lines.push(`unset ${key}`);
    }
  }

  process.stdout.write(`${lines.join('\n')}\n`);
}

if (fatalMessage) {
  process.exit(70);
}

import path from 'path';
import { readOpenClawConfig } from './config-files';
import { readJsonFile } from './json-store';
import { getAdminPaths } from './paths';
import type { NetworkPolicyStatus } from '../types/admin';

interface NetworkPolicySnapshotFile {
  updatedAt?: string;
  mode?: string;
  decision?: string;
  reason?: string;
  configured?: Record<string, string>;
  effective?: Record<string, string>;
  probes?: Array<{ url?: string; ok?: boolean; error?: string }>;
}

interface SandboxDockerConfig {
  network?: string;
  extraHosts?: string[];
  env?: Record<string, string>;
}

interface OpenClawConfig {
  agents?: {
    defaults?: {
      sandbox?: {
        docker?: SandboxDockerConfig;
      };
    };
  };
}

function pickProxyUrl(values?: Record<string, string>) {
  if (!values) return '';
  return values.HTTP_PROXY || values.HTTPS_PROXY || values.ALL_PROXY || values.http_proxy || values.https_proxy || values.all_proxy || '';
}

function simplifyProxyUrl(value: string) {
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return value;
  }
}

function normalizeMode(value?: string): NetworkPolicyStatus['mode'] {
  if (value === 'direct' || value === 'proxy_only') return value;
  if (value === 'auto') return value;
  return 'unknown';
}

function normalizeDecision(value?: string): NetworkPolicyStatus['decision'] {
  if (value === 'proxy' || value === 'proxy_only_failed') return value;
  if (value === 'direct') return value;
  return 'unknown';
}

function humanizeMode(mode: NetworkPolicyStatus['mode']) {
  if (mode === 'auto') return '自动回退';
  if (mode === 'proxy_only') return '仅代理';
  if (mode === 'direct') return '仅直连';
  return '未知';
}

function humanizeDecision(decision: NetworkPolicyStatus['decision']) {
  if (decision === 'proxy') return '当前走代理';
  if (decision === 'direct') return '当前直连';
  if (decision === 'proxy_only_failed') return '代理失败';
  return '未知';
}

function humanizeReason(reason?: string) {
  if (reason === 'proxy_reachable') return '代理可用，已启用代理链路';
  if (reason === 'auto_fallback_direct') return '代理不可达，已自动回退直连';
  if (reason === 'mode_direct') return '策略指定为仅直连';
  if (reason === 'no_proxy_configured') return '未配置代理，直接走直连';
  if (reason === 'proxy_unreachable') return '代理不可达，且当前策略不允许回退';
  return reason || '暂无决策信息';
}

export function summarizeNetworkPolicySnapshot(snapshot: NetworkPolicySnapshotFile, sandboxDocker?: SandboxDockerConfig): NetworkPolicyStatus {
  const failedProbe = snapshot.probes?.find((item) => item.ok === false);
  const configuredProxy = simplifyProxyUrl(pickProxyUrl(snapshot.configured));
  const effectiveProxy = simplifyProxyUrl(pickProxyUrl(snapshot.effective));
  const sandboxProxy = simplifyProxyUrl(pickProxyUrl(sandboxDocker?.env));

  return {
    mode: normalizeMode(snapshot.mode),
    modeLabel: humanizeMode(normalizeMode(snapshot.mode)),
    decision: normalizeDecision(snapshot.decision),
    decisionLabel: humanizeDecision(normalizeDecision(snapshot.decision)),
    reason: humanizeReason(snapshot.reason),
    rawReason: snapshot.reason || '',
    configuredProxy,
    effectiveProxy,
    probeError: failedProbe?.error,
    probeUrl: failedProbe?.url,
    lastCheckedAt: snapshot.updatedAt,
    sandboxNetwork: sandboxDocker?.network || 'none',
    sandboxUsesProxy: Boolean(sandboxProxy),
    sandboxProxy,
    sandboxExtraHostCount: Array.isArray(sandboxDocker?.extraHosts) ? sandboxDocker.extraHosts.length : 0
  };
}

export async function readNetworkPolicyStatus(): Promise<NetworkPolicyStatus> {
  const { adminDataDir } = getAdminPaths();
  const policyPath = path.join(adminDataDir, 'network-policy.json');
  const [snapshot, config] = await Promise.all([
    readJsonFile<NetworkPolicySnapshotFile>(policyPath, {}),
    readOpenClawConfig<OpenClawConfig>().catch(() => ({}) as OpenClawConfig)
  ]);

  return summarizeNetworkPolicySnapshot(snapshot, config.agents?.defaults?.sandbox?.docker);
}

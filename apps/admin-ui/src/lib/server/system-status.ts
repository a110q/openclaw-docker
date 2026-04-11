import { getAdminPaths } from './paths';
import { readJsonFile } from './json-store';
import { inspectComposeServices, type ComposePsItem } from './compose';
import type { AlertChannel, ManagedAgent, SystemStatus } from '../types/admin';

interface OpenClawConfig {
  models?: {
    providers?: Record<string, { models?: Array<{ id: string; name?: string }> }>;
  };
  agents?: {
    defaults?: {
      model?: { primary?: string };
    };
    list?: Array<{ id: string }>;
  };
}

function mapRuntimeStatus(state?: string): SystemStatus['gateway']['status'] {
  const normalized = (state ?? '').toLowerCase();
  if (normalized === 'running') return 'running';
  if (normalized === 'exited' || normalized === 'stopped') return 'stopped';
  if (normalized === 'created' || normalized === 'restarting') return 'starting';
  return 'unknown';
}

function mapHealthStatus(item?: ComposePsItem): SystemStatus['gateway']['health'] {
  const health = (item?.Health ?? '').toLowerCase();
  if (health === 'healthy') return 'healthy';
  if (health === 'starting') return 'starting';
  if (health === 'unhealthy') return 'unhealthy';
  return item?.State?.toLowerCase() === 'running' ? 'healthy' : 'unknown';
}

function formatPublishers(item?: ComposePsItem) {
  return (item?.Publishers ?? []).map((publisher) => {
    const host = publisher.URL || '0.0.0.0';
    return `${host}:${publisher.PublishedPort ?? ''}->${publisher.TargetPort ?? ''}/${publisher.Protocol ?? 'tcp'}`;
  });
}

async function readOpenClawConfig() {
  const { openclawConfigFile } = getAdminPaths();
  return readJsonFile<OpenClawConfig>(openclawConfigFile, {});
}

export async function readSystemStatus(): Promise<SystemStatus> {
  const { managedAgentsFile, alertChannelsFile } = getAdminPaths();
  const [services, config, managedAgents, alertChannels] = await Promise.all([
    inspectComposeServices().catch(() => []),
    readOpenClawConfig(),
    readJsonFile<ManagedAgent[]>(managedAgentsFile, []),
    readJsonFile<AlertChannel[]>(alertChannelsFile, []),
  ]);

  const gateway = services.find((item) => item.Service === 'openclaw-gateway');
  const adminUi = services.find((item) => item.Service === 'openclaw-admin-ui');
  const clawswarm = services.find((item) => item.Service === 'openclaw-clawswarm');
  const defaultModel = config.agents?.defaults?.model?.primary;
  const defaultProvider = defaultModel?.split('/')[0];
  const configAgentCount = config.agents?.list?.length ?? 0;

  return {
    deploymentMode: 'docker',
    gateway: {
      status: mapRuntimeStatus(gateway?.State),
      health: mapHealthStatus(gateway),
      containerName: gateway?.Name,
      image: undefined,
      startedAt: undefined,
      ports: formatPublishers(gateway),
    },
    clawswarm: {
      status: mapRuntimeStatus(clawswarm?.State),
      health: mapHealthStatus(clawswarm),
      containerName: clawswarm?.Name,
      ports: formatPublishers(clawswarm),
    },
    adminUi: {
      status: mapRuntimeStatus(adminUi?.State),
      version: '0.1.0',
    },
    summary: {
      defaultProvider,
      defaultModel,
      managedAgentCount: Math.max(managedAgents.length, configAgentCount),
      enabledAlertChannels: alertChannels.filter((item) => item.enabled).length,
      clawswarmEnabled: mapRuntimeStatus(clawswarm?.State) === 'running',
    },
  };
}

export async function readGatewayLogTail(lines = 120) {
  const { readComposeLogs } = await import('./compose');
  return readComposeLogs('openclaw-gateway', lines);
}

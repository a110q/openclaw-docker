import { randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { ComposePsItem } from './compose';
import { inspectComposeServices } from './compose';
import { ensurePlatformSchema, getPlatformPool } from './platform-db';
import { getPlatformEnv } from './platform-env';
import { listPlatformLobsters, type PlatformLobsterRecord } from './platform-repo';
import type { HealthStatus, RuntimeStatus } from '../types/admin';

export type PlatformSwarmWorkspaceStatus = 'pending' | 'ready' | 'error';
export type PlatformSwarmMemberSyncStatus = 'pending' | 'synced' | 'failed';

export interface PlatformClawSwarmServiceStatus {
  enabled: boolean;
  serviceName: string;
  status: RuntimeStatus;
  health: HealthStatus;
  internalUrl: string;
  publicUrl: string;
  reachable: boolean;
  diagnostics: string[];
}

export interface PlatformSwarmWorkspaceSummary {
  id: string;
  userId: string;
  swarmTenantKey: string;
  swarmUserRef: string;
  status: PlatformSwarmWorkspaceStatus;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSwarmMemberSummary {
  id: string;
  userId: string;
  lobsterId: string;
  swarmMemberRef: string;
  displayName: string;
  archetype: string;
  modelRef: string;
  runtimeAgentId?: string;
  runtimeSyncStatus: PlatformLobsterRecord['runtimeSyncStatus'];
  syncStatus: PlatformSwarmMemberSyncStatus;
  syncError?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSwarmSettingsRecord {
  userId: string;
  preferences: {
    showIntermediateMessages: boolean;
    defaultMode: 'single' | 'swarm';
    autoOpenTasks: boolean;
  };
  updatedAt: string;
}

export interface PlatformSwarmOverview {
  service: PlatformClawSwarmServiceStatus;
  workspace: PlatformSwarmWorkspaceSummary;
  members: PlatformSwarmMemberSummary[];
  settings: PlatformSwarmSettingsRecord;
  counts: {
    totalMembers: number;
    syncedMembers: number;
    failedMembers: number;
    pendingMembers: number;
  };
}

interface SwarmWorkspaceRow extends RowDataPacket {
  id: string;
  user_id: string;
  swarm_tenant_key: string;
  swarm_user_ref: string;
  status: PlatformSwarmWorkspaceStatus;
  last_sync_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface SwarmMemberRow extends RowDataPacket {
  id: string;
  user_id: string;
  lobster_id: string;
  runtime_agent_id: string | null;
  swarm_member_ref: string;
  display_name: string;
  sync_status: PlatformSwarmMemberSyncStatus;
  sync_error: string | null;
  last_synced_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface SwarmSettingsRow extends RowDataPacket {
  user_id: string;
  preferences_json: string;
  updated_at: Date | string;
}

function toIso(value: string | Date | null | undefined) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function mapComposeRuntimeStatus(item?: ComposePsItem): RuntimeStatus {
  const normalized = (item?.State ?? '').toLowerCase();
  if (normalized === 'running') return 'running';
  if (normalized === 'exited' || normalized === 'stopped') return 'stopped';
  if (normalized === 'created' || normalized === 'restarting') return 'starting';
  return 'unknown';
}

function mapComposeHealthStatus(item: ComposePsItem | undefined, reachable: boolean): HealthStatus {
  const health = (item?.Health ?? '').toLowerCase();
  if (health === 'healthy') return 'healthy';
  if (health === 'starting') return 'starting';
  if (health === 'unhealthy') return 'unhealthy';
  if (mapComposeRuntimeStatus(item) === 'running') {
    return reachable ? 'healthy' : 'unhealthy';
  }
  return 'unknown';
}

export function buildPlatformSwarmTenantKey(userId: string) {
  return `tenant_${userId.slice(0, 8)}`;
}

export function buildPlatformSwarmUserRef(userId: string) {
  return `platform_user_${userId.slice(0, 8)}`;
}

export function buildPlatformSwarmMemberRef(lobsterId: string) {
  return `swarm_member_${lobsterId.slice(0, 8)}`;
}

export function derivePlatformClawSwarmServiceStatus(input: {
  enabled: boolean;
  composeItem?: ComposePsItem;
  reachable: boolean;
  internalUrl: string;
  publicUrl: string;
  error?: string;
}): PlatformClawSwarmServiceStatus {
  const diagnostics: string[] = [];
  if (!input.enabled) {
    diagnostics.push('ClawSwarm 集成已在平台环境变量中关闭。');
  }

  const status = mapComposeRuntimeStatus(input.composeItem);
  const health = mapComposeHealthStatus(input.composeItem, input.reachable);

  if (input.enabled && !input.composeItem) {
    diagnostics.push('未发现 openclaw-clawswarm 容器，请先启动 docker compose 服务。');
  }
  if (input.enabled && input.composeItem && status === 'running' && !input.reachable) {
    diagnostics.push(input.error || '服务已运行，但内部健康接口暂时不可达。');
  }
  if (input.enabled && input.composeItem && status !== 'running') {
    diagnostics.push(`当前容器状态为 ${input.composeItem.State || 'unknown'}，尚未进入 running。`);
  }
  if (input.enabled && input.reachable) {
    diagnostics.push('内部健康接口可达，phase1 底座已接通。');
  }

  return {
    enabled: input.enabled,
    serviceName: 'openclaw-clawswarm',
    status,
    health,
    internalUrl: input.internalUrl,
    publicUrl: input.publicUrl,
    reachable: input.reachable,
    diagnostics,
  };
}

export function derivePlatformSwarmMemberSummary(input: {
  lobster: PlatformLobsterRecord;
  existing?: SwarmMemberRow;
}): Omit<PlatformSwarmMemberSummary, 'id' | 'createdAt' | 'updatedAt'> & {
  syncStatus: PlatformSwarmMemberSyncStatus;
  syncError?: string;
} {
  const runtimeSyncStatus = input.lobster.runtimeSyncStatus;
  const syncStatus: PlatformSwarmMemberSyncStatus =
    runtimeSyncStatus === 'failed' ? 'failed' : runtimeSyncStatus === 'synced' ? 'synced' : 'pending';

  return {
    userId: input.lobster.userId,
    lobsterId: input.lobster.id,
    swarmMemberRef: input.existing?.swarm_member_ref || buildPlatformSwarmMemberRef(input.lobster.id),
    displayName: input.lobster.name,
    archetype: input.lobster.archetype,
    modelRef: input.lobster.modelRef,
    runtimeAgentId: input.lobster.runtimeAgentId,
    runtimeSyncStatus,
    syncStatus,
    syncError: input.lobster.runtimeSyncError,
    lastSyncedAt: input.existing?.last_synced_at ? toIso(input.existing.last_synced_at) : undefined,
  };
}

function mapWorkspace(row: SwarmWorkspaceRow): PlatformSwarmWorkspaceSummary {
  return {
    id: row.id,
    userId: row.user_id,
    swarmTenantKey: row.swarm_tenant_key,
    swarmUserRef: row.swarm_user_ref,
    status: row.status,
    lastSyncAt: toIso(row.last_sync_at),
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
  };
}

function mapMember(row: SwarmMemberRow, lobster: PlatformLobsterRecord): PlatformSwarmMemberSummary {
  return {
    id: row.id,
    userId: row.user_id,
    lobsterId: row.lobster_id,
    swarmMemberRef: row.swarm_member_ref,
    displayName: row.display_name,
    archetype: lobster.archetype,
    modelRef: lobster.modelRef,
    runtimeAgentId: row.runtime_agent_id || lobster.runtimeAgentId,
    runtimeSyncStatus: lobster.runtimeSyncStatus,
    syncStatus: row.sync_status,
    syncError: row.sync_error || lobster.runtimeSyncError || undefined,
    lastSyncedAt: toIso(row.last_synced_at),
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
  };
}

function buildDefaultSettings(userId: string): PlatformSwarmSettingsRecord {
  return {
    userId,
    preferences: {
      showIntermediateMessages: true,
      defaultMode: 'swarm',
      autoOpenTasks: true,
    },
    updatedAt: new Date().toISOString(),
  };
}

async function pingClawSwarm(internalUrl: string) {
  try {
    const response = await fetch(`${trimTrailingSlash(internalUrl)}/api/health`, {
      signal: AbortSignal.timeout(1500),
      cache: 'no-store',
    });
    if (!response.ok) {
      return { reachable: false, error: `健康检查返回 HTTP ${response.status}` };
    }
    return { reachable: true, error: '' };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : '无法连接 ClawSwarm 健康接口',
    };
  }
}

export async function readPlatformClawSwarmStatus(): Promise<PlatformClawSwarmServiceStatus> {
  const env = getPlatformEnv();
  const services = await inspectComposeServices().catch(() => []);
  const composeItem = services.find((item) => item.Service === 'openclaw-clawswarm');
  const probe = env.OPENCLAW_CLAWSWARM_ENABLED ? await pingClawSwarm(env.OPENCLAW_CLAWSWARM_INTERNAL_URL) : { reachable: false, error: '' };

  return derivePlatformClawSwarmServiceStatus({
    enabled: env.OPENCLAW_CLAWSWARM_ENABLED,
    composeItem,
    reachable: probe.reachable,
    internalUrl: env.OPENCLAW_CLAWSWARM_INTERNAL_URL,
    publicUrl: env.OPENCLAW_CLAWSWARM_PUBLIC_URL,
    error: probe.error,
  });
}

export async function ensurePlatformSwarmWorkspace(userId: string) {
  await ensurePlatformSchema();
  const pool = getPlatformPool();
  const [rows] = await pool.query<SwarmWorkspaceRow[]>(
    'SELECT * FROM platform_swarm_workspaces WHERE user_id = ? LIMIT 1',
    [userId],
  );

  if (rows[0]) {
    return mapWorkspace(rows[0]);
  }

  const workspace = {
    id: randomUUID(),
    userId,
    swarmTenantKey: buildPlatformSwarmTenantKey(userId),
    swarmUserRef: buildPlatformSwarmUserRef(userId),
  };

  await pool.execute<ResultSetHeader>(
    `INSERT INTO platform_swarm_workspaces (id, user_id, swarm_tenant_key, swarm_user_ref, status, last_sync_at)
     VALUES (?, ?, ?, ?, 'pending', NULL)`,
    [workspace.id, workspace.userId, workspace.swarmTenantKey, workspace.swarmUserRef],
  );

  return {
    id: workspace.id,
    userId: workspace.userId,
    swarmTenantKey: workspace.swarmTenantKey,
    swarmUserRef: workspace.swarmUserRef,
    status: 'pending' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function updateWorkspaceStatus(workspaceId: string, status: PlatformSwarmWorkspaceStatus) {
  await getPlatformPool().execute(
    'UPDATE platform_swarm_workspaces SET status = ?, last_sync_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, workspaceId],
  );
}

export async function readPlatformSwarmSettings(userId: string): Promise<PlatformSwarmSettingsRecord> {
  await ensurePlatformSchema();
  const pool = getPlatformPool();
  const [rows] = await pool.query<SwarmSettingsRow[]>(
    'SELECT * FROM platform_swarm_settings WHERE user_id = ? LIMIT 1',
    [userId],
  );

  if (rows[0]) {
    let preferences = buildDefaultSettings(userId).preferences;
    try {
      preferences = {
        ...preferences,
        ...JSON.parse(rows[0].preferences_json || '{}'),
      };
    } catch {
      preferences = buildDefaultSettings(userId).preferences;
    }

    return {
      userId,
      preferences,
      updatedAt: toIso(rows[0].updated_at) || new Date().toISOString(),
    };
  }

  const defaults = buildDefaultSettings(userId);
  await pool.execute<ResultSetHeader>(
    'INSERT INTO platform_swarm_settings (user_id, preferences_json) VALUES (?, ?)',
    [userId, JSON.stringify(defaults.preferences)],
  );
  return defaults;
}

export async function syncPlatformSwarmMembers(userId: string) {
  await ensurePlatformSchema();
  const pool = getPlatformPool();
  const [lobsters, rows] = await Promise.all([
    listPlatformLobsters(userId),
    pool.query<SwarmMemberRow[]>('SELECT * FROM platform_swarm_members WHERE user_id = ? ORDER BY created_at ASC', [userId]),
  ]);
  const existingRows = rows[0];
  const existingByLobsterId = new Map(existingRows.map((row) => [row.lobster_id, row]));
  const lobsterIds = new Set(lobsters.map((item) => item.id));

  for (const row of existingRows) {
    if (!lobsterIds.has(row.lobster_id)) {
      await pool.execute('DELETE FROM platform_swarm_members WHERE id = ?', [row.id]);
    }
  }

  for (const lobster of lobsters) {
    const existing = existingByLobsterId.get(lobster.id);
    const derived = derivePlatformSwarmMemberSummary({ lobster, existing });
    if (existing) {
      await pool.execute(
        `UPDATE platform_swarm_members
            SET runtime_agent_id = ?, swarm_member_ref = ?, display_name = ?, sync_status = ?, sync_error = ?, last_synced_at = CURRENT_TIMESTAMP
          WHERE id = ?`,
        [
          lobster.runtimeAgentId || null,
          derived.swarmMemberRef,
          derived.displayName,
          derived.syncStatus,
          derived.syncError || null,
          existing.id,
        ],
      );
      continue;
    }

    await pool.execute<ResultSetHeader>(
      `INSERT INTO platform_swarm_members (
        id, user_id, lobster_id, runtime_agent_id, swarm_member_ref, display_name, sync_status, sync_error, last_synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        randomUUID(),
        userId,
        lobster.id,
        lobster.runtimeAgentId || null,
        derived.swarmMemberRef,
        derived.displayName,
        derived.syncStatus,
        derived.syncError || null,
      ],
    );
  }

  const [nextRows] = await pool.query<SwarmMemberRow[]>(
    'SELECT * FROM platform_swarm_members WHERE user_id = ? ORDER BY created_at ASC',
    [userId],
  );
  const lobsterMap = new Map(lobsters.map((item) => [item.id, item]));
  return nextRows
    .map((row) => {
      const lobster = lobsterMap.get(row.lobster_id);
      return lobster ? mapMember(row, lobster) : null;
    })
    .filter((item): item is PlatformSwarmMemberSummary => Boolean(item));
}

export async function listPlatformSwarmMembers(userId: string) {
  return syncPlatformSwarmMembers(userId);
}

export async function readPlatformSwarmOverview(userId: string): Promise<PlatformSwarmOverview> {
  const [service, workspace, members, settings] = await Promise.all([
    readPlatformClawSwarmStatus(),
    ensurePlatformSwarmWorkspace(userId),
    listPlatformSwarmMembers(userId),
    readPlatformSwarmSettings(userId),
  ]);

  const nextStatus: PlatformSwarmWorkspaceStatus = service.enabled
    ? service.reachable
      ? 'ready'
      : 'error'
    : 'pending';
  await updateWorkspaceStatus(workspace.id, nextStatus);

  return {
    service,
    workspace: {
      ...workspace,
      status: nextStatus,
      lastSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    members,
    settings,
    counts: {
      totalMembers: members.length,
      syncedMembers: members.filter((item) => item.syncStatus === 'synced').length,
      failedMembers: members.filter((item) => item.syncStatus === 'failed').length,
      pendingMembers: members.filter((item) => item.syncStatus === 'pending').length,
    },
  };
}

import type { TaskStatus } from '../types/admin';
import { readPlatformClawSwarmStatus, type PlatformClawSwarmServiceStatus } from './platform-clawswarm';
import { getPlatformEnv } from './platform-env';

const CLAWSWARM_SESSION_TTL_MS = 5 * 60 * 1000;

interface ClawSwarmAuthUserRead {
  id: string;
  username: string;
  display_name: string;
  using_default_password: boolean;
}

interface ClawSwarmInstanceRead {
  id: number;
  instance_key: string;
  name: string;
  channel_base_url: string;
  channel_account_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ClawSwarmInstanceHealthRead {
  id: number;
  status: string;
}

interface ClawSwarmAddressBookAgent {
  id: number;
  agent_key: string;
  cs_id: string;
  display_name: string;
  role_name: string | null;
  enabled: boolean;
}

interface ClawSwarmAddressBookInstance {
  id: number;
  name: string;
  status: string;
  agents: ClawSwarmAddressBookAgent[];
}

interface ClawSwarmAddressBookGroupMember {
  id: number;
  instance_id: number;
  agent_id: number;
  display_name: string;
  agent_key: string;
  instance_name: string;
}

interface ClawSwarmAddressBookGroup {
  id: number;
  name: string;
  description: string | null;
  members: ClawSwarmAddressBookGroupMember[];
}

interface ClawSwarmAddressBookResponse {
  instances: ClawSwarmAddressBookInstance[];
  groups: ClawSwarmAddressBookGroup[];
}

interface ClawSwarmConversationListItem {
  id: number;
  type: string;
  title: string | null;
  group_id: number | null;
  direct_instance_id: number | null;
  direct_agent_id: number | null;
  display_title: string;
  group_name: string | null;
  instance_name: string | null;
  agent_display_name: string | null;
  dialogue_source_agent_name?: string | null;
  dialogue_target_agent_name?: string | null;
  dialogue_status?: string | null;
  dialogue_window_seconds?: number | null;
  dialogue_soft_message_limit?: number | null;
  dialogue_hard_message_limit?: number | null;
  last_message_id: string | null;
  last_message_preview: string | null;
  last_message_sender_type: string | null;
  last_message_sender_label: string | null;
  last_message_at: string | null;
  last_message_status: string | null;
  created_at: string;
  updated_at: string;
}

interface CachedClawSwarmSession {
  baseUrl: string;
  username: string;
  password: string;
  cookieHeader: string;
  user: ClawSwarmAuthUserRead;
  expiresAt: number;
}

export interface PlatformClawSwarmAuthStatus {
  reachable: boolean;
  authenticated: boolean;
  username?: string;
  displayName?: string;
  usingDefaultPassword: boolean;
  diagnostics: string[];
}

export interface PlatformClawSwarmInstanceSummary {
  id: number;
  name: string;
  instanceKey: string;
  channelBaseUrl: string;
  channelAccountId: string;
  status: string;
  runtimeStatus: string;
  agentCount: number;
  enabledAgentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformClawSwarmGroupSummary {
  id: number;
  name: string;
  description?: string;
  memberCount: number;
  members: Array<{
    id: number;
    displayName: string;
    agentKey: string;
    instanceName: string;
  }>;
}

export interface PlatformClawSwarmConversationSummary {
  id: number;
  type: string;
  displayTitle: string;
  title?: string;
  groupName?: string;
  instanceName?: string;
  agentDisplayName?: string;
  dialogueSourceAgentName?: string;
  dialogueTargetAgentName?: string;
  dialogueStatus?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  lastMessageSenderType?: string;
  lastMessageSenderLabel?: string;
  lastMessageStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformClawSwarmTaskSummary {
  id: string;
  conversationId: number;
  title: string;
  status: TaskStatus;
  rawStatus?: string;
  sourceAgentName?: string;
  targetAgentName?: string;
  lastMessageAt?: string;
  summary?: string;
}

export interface PlatformClawSwarmRuntimeSnapshot {
  service: PlatformClawSwarmServiceStatus;
  auth: PlatformClawSwarmAuthStatus;
  instances: PlatformClawSwarmInstanceSummary[];
  groups: PlatformClawSwarmGroupSummary[];
  conversations: PlatformClawSwarmConversationSummary[];
  tasks: PlatformClawSwarmTaskSummary[];
  warnings: string[];
}

let cachedSession: CachedClawSwarmSession | null = null;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function buildErrorMessage(response: Response, payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) {
      return `${fallback}（HTTP ${response.status}：${detail.trim()}）`;
    }
  }
  return `${fallback}（HTTP ${response.status}）`;
}

async function createClawSwarmSession(forceRefresh = false): Promise<CachedClawSwarmSession> {
  const env = getPlatformEnv();
  const baseUrl = trimTrailingSlash(env.OPENCLAW_CLAWSWARM_INTERNAL_URL);
  const username = env.OPENCLAW_CLAWSWARM_USERNAME;
  const password = env.OPENCLAW_CLAWSWARM_PASSWORD;
  const now = Date.now();

  if (
    !forceRefresh &&
    cachedSession &&
    cachedSession.baseUrl === baseUrl &&
    cachedSession.username === username &&
    cachedSession.password === password &&
    cachedSession.expiresAt > now
  ) {
    return cachedSession;
  }

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    cache: 'no-store',
    signal: AbortSignal.timeout(4000),
  });
  const payload = (await response.json().catch(() => ({}))) as ClawSwarmAuthUserRead | { detail?: string };
  const cookieHeader = (response.headers.get('set-cookie') || '').split(';', 1)[0]?.trim();

  if (!response.ok || !cookieHeader || !('username' in payload)) {
    throw new Error(buildErrorMessage(response, payload, 'ClawSwarm 登录失败，请检查平台中配置的运行时账号'));
  }

  cachedSession = {
    baseUrl,
    username,
    password,
    cookieHeader,
    user: payload,
    expiresAt: now + CLAWSWARM_SESSION_TTL_MS,
  };
  return cachedSession;
}

async function fetchClawSwarmJson<T>(path: string, init?: RequestInit): Promise<T> {
  const env = getPlatformEnv();
  const baseUrl = trimTrailingSlash(env.OPENCLAW_CLAWSWARM_INTERNAL_URL);

  const perform = async (forceRefresh = false) => {
    const session = await createClawSwarmSession(forceRefresh);
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        cookie: session.cookieHeader,
      },
      cache: 'no-store',
      signal: init?.signal || AbortSignal.timeout(5000),
    });

    if (response.status === 401 && !forceRefresh) {
      cachedSession = null;
      return perform(true);
    }

    const payload = (await response.json().catch(() => ({}))) as T | { detail?: string };
    if (!response.ok) {
      throw new Error(buildErrorMessage(response, payload, `ClawSwarm 请求失败：${path}`));
    }
    return payload as T;
  };

  return perform(false);
}

export function mergePlatformClawSwarmInstances(input: {
  instances: ClawSwarmInstanceRead[];
  health: ClawSwarmInstanceHealthRead[];
  addressBookInstances: ClawSwarmAddressBookInstance[];
}): PlatformClawSwarmInstanceSummary[] {
  const healthMap = new Map(input.health.map((item) => [item.id, item.status]));
  const addressBookMap = new Map(input.addressBookInstances.map((item) => [item.id, item]));

  return input.instances.map((instance) => {
    const address = addressBookMap.get(instance.id);
    const runtimeStatus = healthMap.get(instance.id) || (instance.status === 'disabled' ? 'disabled' : 'unknown');
    const agents = address?.agents || [];

    return {
      id: instance.id,
      name: instance.name,
      instanceKey: instance.instance_key,
      channelBaseUrl: instance.channel_base_url,
      channelAccountId: instance.channel_account_id,
      status: instance.status,
      runtimeStatus,
      agentCount: agents.length,
      enabledAgentCount: agents.filter((item) => item.enabled).length,
      createdAt: instance.created_at,
      updatedAt: instance.updated_at,
    };
  });
}

export function normalizePlatformClawSwarmTaskStatus(value?: string | null): TaskStatus {
  const normalized = (value || '').trim().toLowerCase();
  if (['running', 'accepted', 'streaming', 'active', 'resumed'].includes(normalized)) {
    return 'running';
  }
  if (['succeeded', 'success', 'completed', 'finished', 'done'].includes(normalized)) {
    return 'succeeded';
  }
  if (['failed', 'error', 'stopped'].includes(normalized)) {
    return 'failed';
  }
  return 'pending';
}

export function derivePlatformClawSwarmTasks(
  conversations: PlatformClawSwarmConversationSummary[],
): PlatformClawSwarmTaskSummary[] {
  return conversations
    .filter((item) => item.type === 'agent_dialogue' || Boolean(item.dialogueStatus))
    .map((item) => ({
      id: `conversation-${item.id}`,
      conversationId: item.id,
      title: item.displayTitle,
      status: normalizePlatformClawSwarmTaskStatus(item.dialogueStatus),
      rawStatus: item.dialogueStatus,
      sourceAgentName: item.dialogueSourceAgentName,
      targetAgentName: item.dialogueTargetAgentName,
      lastMessageAt: item.lastMessageAt,
      summary: item.lastMessagePreview,
    }));
}

function mapPlatformClawSwarmGroups(groups: ClawSwarmAddressBookGroup[]): PlatformClawSwarmGroupSummary[] {
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description || undefined,
    memberCount: group.members.length,
    members: group.members.map((member) => ({
      id: member.id,
      displayName: member.display_name,
      agentKey: member.agent_key,
      instanceName: member.instance_name,
    })),
  }));
}

function mapPlatformClawSwarmConversations(
  conversations: ClawSwarmConversationListItem[],
): PlatformClawSwarmConversationSummary[] {
  return conversations.map((item) => ({
    id: item.id,
    type: item.type,
    displayTitle: item.display_title,
    title: item.title || undefined,
    groupName: item.group_name || undefined,
    instanceName: item.instance_name || undefined,
    agentDisplayName: item.agent_display_name || undefined,
    dialogueSourceAgentName: item.dialogue_source_agent_name || undefined,
    dialogueTargetAgentName: item.dialogue_target_agent_name || undefined,
    dialogueStatus: item.dialogue_status || undefined,
    lastMessagePreview: item.last_message_preview || undefined,
    lastMessageAt: item.last_message_at || undefined,
    lastMessageSenderType: item.last_message_sender_type || undefined,
    lastMessageSenderLabel: item.last_message_sender_label || undefined,
    lastMessageStatus: item.last_message_status || undefined,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  }));
}

function buildRuntimeWarnings(input: {
  auth: PlatformClawSwarmAuthStatus;
  instances: PlatformClawSwarmInstanceSummary[];
  conversations: PlatformClawSwarmConversationSummary[];
}): string[] {
  const warnings: string[] = [];

  if (!input.auth.authenticated) {
    warnings.push(...input.auth.diagnostics);
    return Array.from(new Set(warnings));
  }

  if (input.auth.usingDefaultPassword) {
    warnings.push('ClawSwarm 仍在使用默认登录密码，建议尽快修改，避免运行时后台被弱口令访问。');
  }

  if (!input.instances.length) {
    warnings.push('ClawSwarm 已启动，但当前还没有接入任何 OpenClaw 实例。');
  }

  const offlineCount = input.instances.filter((item) => item.runtimeStatus === 'offline').length;
  if (offlineCount > 0) {
    warnings.push(`有 ${offlineCount} 个已接入实例当前离线，建议检查 clawswarm channel 插件与网关连通性。`);
  }

  if (input.instances.length > 0 && input.conversations.length === 0) {
    warnings.push('运行时已经接入实例，但暂时还没有会话记录。');
  }

  return Array.from(new Set(warnings));
}

export async function readPlatformClawSwarmRuntimeSnapshot(): Promise<PlatformClawSwarmRuntimeSnapshot> {
  const service = await readPlatformClawSwarmStatus();
  if (!service.enabled || !service.reachable) {
    return {
      service,
      auth: {
        reachable: service.reachable,
        authenticated: false,
        usingDefaultPassword: false,
        diagnostics: service.enabled
          ? ['ClawSwarm 服务尚未就绪，暂时无法读取运行时实例与会话数据。']
          : ['ClawSwarm 集成已关闭。'],
      },
      instances: [],
      groups: [],
      conversations: [],
      tasks: [],
      warnings: service.diagnostics,
    };
  }

  try {
    const session = await createClawSwarmSession(false);
    const [instances, health, addressBook, conversations] = await Promise.all([
      fetchClawSwarmJson<ClawSwarmInstanceRead[]>('/api/instances'),
      fetchClawSwarmJson<ClawSwarmInstanceHealthRead[]>('/api/instances/health'),
      fetchClawSwarmJson<ClawSwarmAddressBookResponse>('/api/address-book'),
      fetchClawSwarmJson<ClawSwarmConversationListItem[]>('/api/conversations'),
    ]);

    const mergedInstances = mergePlatformClawSwarmInstances({
      instances,
      health,
      addressBookInstances: addressBook.instances,
    });
    const mappedConversations = mapPlatformClawSwarmConversations(conversations);
    const auth: PlatformClawSwarmAuthStatus = {
      reachable: true,
      authenticated: true,
      username: session.user.username,
      displayName: session.user.display_name,
      usingDefaultPassword: session.user.using_default_password,
      diagnostics: ['平台适配层已成功登录 ClawSwarm 运行时。'],
    };

    return {
      service,
      auth,
      instances: mergedInstances,
      groups: mapPlatformClawSwarmGroups(addressBook.groups),
      conversations: mappedConversations,
      tasks: derivePlatformClawSwarmTasks(mappedConversations),
      warnings: buildRuntimeWarnings({
        auth,
        instances: mergedInstances,
        conversations: mappedConversations,
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ClawSwarm 运行时认证失败';
    const auth: PlatformClawSwarmAuthStatus = {
      reachable: true,
      authenticated: false,
      usingDefaultPassword: false,
      diagnostics: [message],
    };

    return {
      service,
      auth,
      instances: [],
      groups: [],
      conversations: [],
      tasks: [],
      warnings: [message],
    };
  }
}

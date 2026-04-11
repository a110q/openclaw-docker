import { getPlatformEnv } from './platform-env';
import { getPlatformLobster, listPlatformLobsters, type PlatformLobsterRecord } from './platform-repo';

const CLAWSWARM_CHAT_SESSION_TTL_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 1000;
const POLL_ATTEMPTS = 35;

type LobsterRuntimeStatus = PlatformLobsterRecord['runtimeSyncStatus'];

interface ClawSwarmAuthUserRead {
  id: string;
  username: string;
  display_name: string;
  using_default_password: boolean;
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

interface ClawSwarmAddressBookResponse {
  instances: ClawSwarmAddressBookInstance[];
  groups: Array<unknown>;
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
  last_message_id: string | null;
  last_message_preview: string | null;
  last_message_sender_type: string | null;
  last_message_sender_label: string | null;
  last_message_at: string | null;
  last_message_status: string | null;
  created_at: string;
  updated_at: string;
}

interface ClawSwarmConversationRead {
  id: number;
  type: string;
  title: string | null;
  group_id: number | null;
  direct_instance_id: number | null;
  direct_agent_id: number | null;
  agent_dialogue_id?: number | null;
  created_at: string;
  updated_at: string;
}

interface ClawSwarmMessageRead {
  id: string;
  conversation_id: number;
  sender_type: string;
  sender_label: string;
  sender_cs_id?: string | null;
  source?: string | null;
  content: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ClawSwarmDispatchRead {
  id: string;
  message_id: string;
  conversation_id: number;
  instance_id: number;
  agent_id: number;
  dispatch_mode: string;
  channel_message_id?: string | null;
  channel_trace_id?: string | null;
  session_key?: string | null;
  status: string;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

interface ClawSwarmConversationMessagesResponse {
  conversation: ClawSwarmConversationRead;
  messages: ClawSwarmMessageRead[];
  dispatches: ClawSwarmDispatchRead[];
  next_message_cursor: string | null;
  next_dispatch_cursor: string | null;
}

interface ClawSwarmMessageCreateResponse extends ClawSwarmMessageRead {}

interface CachedClawSwarmSession {
  baseUrl: string;
  username: string;
  password: string;
  cookieHeader: string;
  user: ClawSwarmAuthUserRead;
  expiresAt: number;
}

export interface PlatformClawSwarmRuntimeAgentDirectoryEntry {
  id: number;
  instanceId: number;
  instanceName: string;
  instanceStatus: string;
  agentKey: string;
  csId: string;
  displayName: string;
  roleName?: string;
  enabled: boolean;
}

export interface PlatformClawSwarmChatTarget {
  id: string;
  name: string;
  archetype: string;
  modelRef: string;
  runtimeSyncStatus: LobsterRuntimeStatus;
  runtimeAgentId?: string;
  runtimeAgentNumericId?: number;
  runtimeConversationId?: number;
  runtimeConversationUrl?: string;
}

export interface PlatformClawSwarmConversationEntry {
  id: number;
  lobsterId?: string;
  lobsterName?: string;
  agentKey?: string;
  displayTitle: string;
  instanceName?: string;
  agentDisplayName?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  lastMessageStatus?: string;
  dialogueStatus?: string;
  directAgentId?: number;
  directInstanceId?: number;
  createdAt: string;
  updatedAt: string;
  externalUrl: string;
}

export interface PlatformClawSwarmConversationMessageEntry {
  id: string;
  conversationId: number;
  senderType: string;
  senderLabel: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformClawSwarmConversationDispatchEntry {
  id: string;
  messageId: string;
  conversationId: number;
  instanceId: number;
  agentId: number;
  dispatchMode: string;
  status: string;
  errorMessage?: string;
  sessionKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformClawSwarmConversationDetail {
  lobsterId?: string;
  lobsterName?: string;
  agentKey?: string;
  conversationId: number;
  displayTitle: string;
  externalUrl: string;
  messages: PlatformClawSwarmConversationMessageEntry[];
  dispatches: PlatformClawSwarmConversationDispatchEntry[];
  directAgentId?: number;
  directInstanceId?: number;
  updatedAt: string;
}

export interface PlatformClawSwarmChatWorkspace {
  targets: PlatformClawSwarmChatTarget[];
  selectedLobsterId?: string;
  recentConversations: PlatformClawSwarmConversationEntry[];
  currentConversation: PlatformClawSwarmConversationDetail | null;
}

let cachedSession: CachedClawSwarmSession | null = null;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    throw new Error(buildErrorMessage(response, payload, 'ClawSwarm 登录失败，请检查运行时账号'));
  }

  cachedSession = {
    baseUrl,
    username,
    password,
    cookieHeader,
    user: payload,
    expiresAt: now + CLAWSWARM_CHAT_SESSION_TTL_MS,
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

function toOptional<T>(value: T | null | undefined) {
  return value == null ? undefined : value;
}

export function buildPlatformClawSwarmRuntimeAgentDirectory(
  instances: ClawSwarmAddressBookInstance[],
): PlatformClawSwarmRuntimeAgentDirectoryEntry[] {
  return instances.flatMap((instance) =>
    instance.agents.map((agent) => ({
      id: agent.id,
      instanceId: instance.id,
      instanceName: instance.name,
      instanceStatus: instance.status,
      agentKey: agent.agent_key,
      csId: agent.cs_id,
      displayName: agent.display_name,
      roleName: toOptional(agent.role_name),
      enabled: agent.enabled,
    })),
  );
}

export function filterPlatformClawSwarmConversationsForLobsters(input: {
  publicBaseUrl: string;
  agents: PlatformClawSwarmRuntimeAgentDirectoryEntry[];
  lobsters: Array<Pick<PlatformLobsterRecord, 'id' | 'name' | 'archetype' | 'modelRef' | 'runtimeAgentId' | 'runtimeSyncStatus'>>;
  conversations: ClawSwarmConversationListItem[];
}): PlatformClawSwarmConversationEntry[] {
  const agentById = new Map(input.agents.map((agent) => [agent.id, agent]));
  const lobsterByAgentKey = new Map(
    input.lobsters
      .filter((lobster) => lobster.runtimeSyncStatus === 'synced' && lobster.runtimeAgentId)
      .map((lobster) => [lobster.runtimeAgentId as string, lobster]),
  );
  const publicBaseUrl = trimTrailingSlash(input.publicBaseUrl);

  const entries: PlatformClawSwarmConversationEntry[] = [];

  for (const conversation of input.conversations) {
    if (conversation.type !== 'direct' || !conversation.direct_agent_id) {
      continue;
    }

    const agent = agentById.get(conversation.direct_agent_id);
    if (!agent) {
      continue;
    }

    const lobster = lobsterByAgentKey.get(agent.agentKey);
    if (!lobster) {
      continue;
    }

    entries.push({
      id: conversation.id,
      lobsterId: lobster.id,
      lobsterName: lobster.name,
      agentKey: agent.agentKey,
      displayTitle: conversation.display_title,
      instanceName: toOptional(conversation.instance_name),
      agentDisplayName: toOptional(conversation.agent_display_name),
      lastMessagePreview: toOptional(conversation.last_message_preview),
      lastMessageAt: toOptional(conversation.last_message_at),
      lastMessageStatus: toOptional(conversation.last_message_status),
      dialogueStatus: toOptional(conversation.dialogue_status),
      directAgentId: toOptional(conversation.direct_agent_id),
      directInstanceId: toOptional(conversation.direct_instance_id),
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      externalUrl: `${publicBaseUrl}/messages/conversation/${conversation.id}`,
    });
  }

  return entries.sort((left, right) => {
    const rightTime = Date.parse(right.lastMessageAt || right.updatedAt || right.createdAt || '');
    const leftTime = Date.parse(left.lastMessageAt || left.updatedAt || left.createdAt || '');
    return rightTime - leftTime;
  });
}

function mapConversationMessage(message: ClawSwarmMessageRead): PlatformClawSwarmConversationMessageEntry {
  return {
    id: message.id,
    conversationId: message.conversation_id,
    senderType: message.sender_type,
    senderLabel: message.sender_label,
    content: message.content,
    status: message.status,
    createdAt: message.created_at,
    updatedAt: message.updated_at,
  };
}

function mapConversationDispatch(dispatch: ClawSwarmDispatchRead): PlatformClawSwarmConversationDispatchEntry {
  return {
    id: dispatch.id,
    messageId: dispatch.message_id,
    conversationId: dispatch.conversation_id,
    instanceId: dispatch.instance_id,
    agentId: dispatch.agent_id,
    dispatchMode: dispatch.dispatch_mode,
    status: dispatch.status,
    errorMessage: toOptional(dispatch.error_message),
    sessionKey: toOptional(dispatch.session_key),
    createdAt: dispatch.created_at,
    updatedAt: dispatch.updated_at,
  };
}

async function readRuntimeDirectory() {
  const [addressBook, conversations] = await Promise.all([
    fetchClawSwarmJson<ClawSwarmAddressBookResponse>('/api/address-book'),
    fetchClawSwarmJson<ClawSwarmConversationListItem[]>('/api/conversations'),
  ]);

  return {
    agents: buildPlatformClawSwarmRuntimeAgentDirectory(addressBook.instances || []),
    conversations,
  };
}

function buildChatTargets(input: {
  lobsters: PlatformLobsterRecord[];
  agents: PlatformClawSwarmRuntimeAgentDirectoryEntry[];
  conversations: PlatformClawSwarmConversationEntry[];
}): PlatformClawSwarmChatTarget[] {
  const agentByKey = new Map(input.agents.map((agent) => [agent.agentKey, agent]));
  const conversationByLobsterId = new Map<string, PlatformClawSwarmConversationEntry>();
  for (const conversation of input.conversations) {
    if (conversation.lobsterId && !conversationByLobsterId.has(conversation.lobsterId)) {
      conversationByLobsterId.set(conversation.lobsterId, conversation);
    }
  }

  return input.lobsters.map((lobster) => {
    const runtimeAgent = lobster.runtimeAgentId ? agentByKey.get(lobster.runtimeAgentId) : undefined;
    const conversation = conversationByLobsterId.get(lobster.id);
    return {
      id: lobster.id,
      name: lobster.name,
      archetype: lobster.archetype,
      modelRef: lobster.modelRef,
      runtimeSyncStatus: lobster.runtimeSyncStatus,
      runtimeAgentId: lobster.runtimeAgentId,
      runtimeAgentNumericId: runtimeAgent?.id,
      runtimeConversationId: conversation?.id,
      runtimeConversationUrl: conversation?.externalUrl,
    } satisfies PlatformClawSwarmChatTarget;
  });
}

function resolveSelectedLobsterId(targets: PlatformClawSwarmChatTarget[], requestedLobsterId?: string) {
  if (requestedLobsterId && targets.some((target) => target.id === requestedLobsterId)) {
    return requestedLobsterId;
  }
  return targets[0]?.id;
}

async function readConversationMessages(conversationId: number) {
  return fetchClawSwarmJson<ClawSwarmConversationMessagesResponse>(
    `/api/conversations/${conversationId}/messages?limit=100&includeDispatches=true`,
  );
}

async function ensureDirectConversation(agent: PlatformClawSwarmRuntimeAgentDirectoryEntry) {
  return fetchClawSwarmJson<ClawSwarmConversationRead>('/api/conversations/direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instance_id: agent.instanceId,
      agent_id: agent.id,
    }),
    signal: AbortSignal.timeout(5000),
  });
}

function buildConversationDetail(input: {
  conversation: ClawSwarmConversationRead;
  messagesResponse: ClawSwarmConversationMessagesResponse;
  currentEntry?: PlatformClawSwarmConversationEntry;
  lobster?: PlatformLobsterRecord;
  agent?: PlatformClawSwarmRuntimeAgentDirectoryEntry;
  publicBaseUrl: string;
}): PlatformClawSwarmConversationDetail {
  const entry = input.currentEntry;
  return {
    lobsterId: input.lobster?.id,
    lobsterName: input.lobster?.name,
    agentKey: input.agent?.agentKey || entry?.agentKey,
    conversationId: input.conversation.id,
    displayTitle:
      entry?.displayTitle ||
      input.conversation.title ||
      `${input.agent?.displayName || 'OpenClaw'} / ${input.lobster?.name || 'Conversation'}`,
    externalUrl: `${trimTrailingSlash(input.publicBaseUrl)}/messages/conversation/${input.conversation.id}`,
    messages: input.messagesResponse.messages.map(mapConversationMessage),
    dispatches: input.messagesResponse.dispatches.map(mapConversationDispatch),
    directAgentId: toOptional(input.conversation.direct_agent_id),
    directInstanceId: toOptional(input.conversation.direct_instance_id),
    updatedAt: input.messagesResponse.conversation.updated_at,
  };
}

async function readUserConversationIndex(userId: string, lobsters: PlatformLobsterRecord[]) {
  const publicBaseUrl = trimTrailingSlash(getPlatformEnv().OPENCLAW_CLAWSWARM_PUBLIC_URL);
  const { agents, conversations } = await readRuntimeDirectory();
  const recentConversations = filterPlatformClawSwarmConversationsForLobsters({
    publicBaseUrl,
    agents,
    lobsters,
    conversations,
  });
  const targets = buildChatTargets({ lobsters, agents, conversations: recentConversations });
  return { publicBaseUrl, agents, recentConversations, targets };
}

async function resolveRuntimeAgentForLobster(userId: string, lobsterId: string) {
  const [lobster, directory] = await Promise.all([
    getPlatformLobster(userId, lobsterId),
    readRuntimeDirectory(),
  ]);

  if (!lobster) {
    throw new Error('龙虾不存在或不属于当前账号');
  }
  if (lobster.runtimeSyncStatus !== 'synced' || !lobster.runtimeAgentId) {
    throw new Error('该龙虾尚未同步到 ClawSwarm 运行时');
  }

  const agent = directory.agents.find((item) => item.agentKey === lobster.runtimeAgentId);
  if (!agent) {
    throw new Error('运行时通讯录中找不到这只龙虾，请先重新同步 OpenClaw 实例');
  }

  return { lobster, agent, directory };
}

export async function readPlatformClawSwarmChatWorkspace(
  userId: string,
  requestedLobsterId?: string,
): Promise<PlatformClawSwarmChatWorkspace> {
  const lobsters = await listPlatformLobsters(userId);
  if (!lobsters.length) {
    return {
      targets: [],
      selectedLobsterId: undefined,
      recentConversations: [],
      currentConversation: null,
    };
  }

  const { publicBaseUrl, agents, recentConversations, targets } = await readUserConversationIndex(userId, lobsters);
  const selectedLobsterId = resolveSelectedLobsterId(targets, requestedLobsterId);
  const selectedTarget = targets.find((item) => item.id === selectedLobsterId);
  const selectedConversation = recentConversations.find((item) => item.lobsterId === selectedLobsterId) || null;

  if (!selectedTarget || !selectedConversation) {
    return {
      targets,
      selectedLobsterId,
      recentConversations,
      currentConversation: null,
    };
  }

  const lobster = lobsters.find((item) => item.id === selectedLobsterId);
  const agent = agents.find((item) => item.id === selectedConversation.directAgentId);
  const messagesResponse = await readConversationMessages(selectedConversation.id);

  return {
    targets,
    selectedLobsterId,
    recentConversations,
    currentConversation: buildConversationDetail({
      conversation: messagesResponse.conversation,
      messagesResponse,
      currentEntry: selectedConversation,
      lobster,
      agent,
      publicBaseUrl,
    }),
  };
}

export async function readPlatformClawSwarmConversationForLobster(userId: string, lobsterId: string) {
  const { lobster, agent, directory } = await resolveRuntimeAgentForLobster(userId, lobsterId);
  const publicBaseUrl = trimTrailingSlash(getPlatformEnv().OPENCLAW_CLAWSWARM_PUBLIC_URL);
  const conversations = await fetchClawSwarmJson<ClawSwarmConversationListItem[]>('/api/conversations');
  const entries = filterPlatformClawSwarmConversationsForLobsters({
    publicBaseUrl,
    agents: directory.agents,
    lobsters: [lobster],
    conversations,
  });
  const currentEntry = entries.find((item) => item.lobsterId === lobster.id) || null;
  if (!currentEntry) {
    return {
      recentConversations: entries,
      currentConversation: null,
    };
  }
  const messagesResponse = await readConversationMessages(currentEntry.id);
  return {
    recentConversations: entries,
    currentConversation: buildConversationDetail({
      conversation: messagesResponse.conversation,
      messagesResponse,
      currentEntry,
      lobster,
      agent,
      publicBaseUrl,
    }),
  };
}

export async function sendPlatformClawSwarmConversationMessage(input: {
  userId: string;
  lobsterId: string;
  content: string;
}) {
  const content = input.content.trim();
  if (!content) {
    throw new Error('消息内容不能为空');
  }

  const { lobster, agent, directory } = await resolveRuntimeAgentForLobster(input.userId, input.lobsterId);
  const publicBaseUrl = trimTrailingSlash(getPlatformEnv().OPENCLAW_CLAWSWARM_PUBLIC_URL);
  const conversation = await ensureDirectConversation(agent);

  const acceptedMessage = await fetchClawSwarmJson<ClawSwarmMessageCreateResponse>(
    `/api/conversations/${conversation.id}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(8000),
    },
  );

  let latest = await readConversationMessages(conversation.id);
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    const currentMessage = latest.messages.find((item) => item.id === acceptedMessage.id);
    const currentDispatch = latest.dispatches.find((item) => item.message_id === acceptedMessage.id);
    const hasAgentReply = latest.messages.some(
      (item) => item.sender_type !== 'user' && Date.parse(item.created_at) >= Date.parse(acceptedMessage.created_at),
    );

    if (currentDispatch?.status === 'failed' || currentMessage?.status === 'failed') {
      throw new Error(currentDispatch?.error_message || '运行时消息发送失败');
    }

    if (hasAgentReply || (currentDispatch?.status === 'completed' && currentMessage?.status === 'completed')) {
      break;
    }

    if (attempt < POLL_ATTEMPTS - 1) {
      await sleep(POLL_INTERVAL_MS);
      latest = await readConversationMessages(conversation.id);
    }
  }

  const runtimeConversations = await fetchClawSwarmJson<ClawSwarmConversationListItem[]>('/api/conversations');
  const recentConversations = filterPlatformClawSwarmConversationsForLobsters({
    publicBaseUrl,
    agents: directory.agents,
    lobsters: [lobster],
    conversations: runtimeConversations,
  });
  const currentEntry = recentConversations.find((item) => item.id === conversation.id) || undefined;

  return {
    recentConversations,
    currentConversation: buildConversationDetail({
      conversation: latest.conversation,
      messagesResponse: latest,
      currentEntry,
      lobster,
      agent,
      publicBaseUrl,
    }),
  };
}

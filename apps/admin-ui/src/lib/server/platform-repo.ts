import { randomBytes, randomUUID } from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getPlatformEnv } from './platform-env';
import { ensurePlatformSchema, getPlatformPool } from './platform-db';
import { decryptSecret, encryptSecret, hashPassword, maskSecret, verifyPassword } from './platform-security';
import { listModels, saveProvider } from './providers';
import { deleteAgent, saveAgent, saveAgentBindings } from './agents';

export interface PlatformUserRecord {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
  createdAt: string;
  lastLoginAt?: string;
}

export interface PlatformSessionRecord {
  id: string;
  expiresAt: string;
  user: PlatformUserRecord;
}

export interface PlatformProviderRecord {
  id: string;
  userId: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKeyMasked: string;
  modelId: string;
  modelName: string;
  runtimeProviderId: string;
  runtimeModelRef: string;
  syncStatus: 'pending' | 'synced' | 'failed';
  syncError?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformLobsterRecord {
  id: string;
  userId: string;
  name: string;
  archetype: string;
  personaSummary?: string;
  modelRef: string;
  providerId?: string;
  runtimeAgentId?: string;
  runtimeSyncStatus: 'pending' | 'synced' | 'failed';
  runtimeSyncError?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SharedModelChoice {
  id: string;
  label: string;
  type: 'shared' | 'private';
}

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
  created_at: Date | string;
  last_login_at: Date | string | null;
}

interface SessionRow extends RowDataPacket {
  session_id: string;
  expires_at: Date | string;
  user_id: string;
  email: string;
  display_name: string;
  role: 'user' | 'admin';
  status: 'active' | 'disabled';
  created_at: Date | string;
  last_login_at: Date | string | null;
}

interface ProviderRow extends RowDataPacket {
  id: string;
  user_id: string;
  name: string;
  type: string;
  base_url: string;
  api_key_encrypted: string;
  model_id: string;
  model_name: string;
  runtime_provider_id: string;
  runtime_model_ref: string;
  sync_status: 'pending' | 'synced' | 'failed';
  sync_error: string | null;
  is_default: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface LobsterRow extends RowDataPacket {
  id: string;
  user_id: string;
  name: string;
  archetype: string;
  persona_summary: string | null;
  model_ref: string;
  provider_id: string | null;
  runtime_agent_id: string | null;
  runtime_sync_status: 'pending' | 'synced' | 'failed';
  runtime_sync_error: string | null;
  is_default: number;
  created_at: Date | string;
  updated_at: Date | string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toIso(value: string | Date | null | undefined) {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapUser(row: UserRow): PlatformUserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    lastLoginAt: toIso(row.last_login_at),
  };
}

function mapProvider(row: ProviderRow): PlatformProviderRecord {
  const apiKey = decryptSecret(row.api_key_encrypted);
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    baseUrl: row.base_url,
    apiKeyMasked: maskSecret(apiKey),
    modelId: row.model_id,
    modelName: row.model_name,
    runtimeProviderId: row.runtime_provider_id,
    runtimeModelRef: row.runtime_model_ref,
    syncStatus: row.sync_status,
    syncError: row.sync_error || undefined,
    isDefault: Boolean(row.is_default),
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
  };
}

function mapLobster(row: LobsterRow): PlatformLobsterRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    archetype: row.archetype,
    personaSummary: row.persona_summary || undefined,
    modelRef: row.model_ref,
    providerId: row.provider_id || undefined,
    runtimeAgentId: row.runtime_agent_id || undefined,
    runtimeSyncStatus: row.runtime_sync_status,
    runtimeSyncError: row.runtime_sync_error || undefined,
    isDefault: Boolean(row.is_default),
    createdAt: toIso(row.created_at) || new Date().toISOString(),
    updatedAt: toIso(row.updated_at) || new Date().toISOString(),
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'model';
}

function buildRuntimeProviderId(userId: string, name: string) {
  return `tenant_${userId.slice(0, 8)}_${slugify(name)}_${randomBytes(3).toString('hex')}`;
}

function buildRuntimeAgentId(userId: string, lobsterId: string) {
  return `lobster_${userId.slice(0, 8)}_${lobsterId.slice(0, 8)}`;
}

async function resolveInitialModelRef() {
  try {
    const models = await listModels();
    return models.find((item) => item.isDefault)?.id || models[0]?.id || getPlatformEnv().OPENCLAW_PLATFORM_DEFAULT_MODEL;
  } catch {
    return getPlatformEnv().OPENCLAW_PLATFORM_DEFAULT_MODEL;
  }
}

async function loadDefaultProviderForUser(userId: string) {
  await ensurePlatformSchema();
  const pool = getPlatformPool();
  const [rows] = await pool.query<ProviderRow[]>(
    'SELECT * FROM platform_providers WHERE user_id = ? AND is_default = 1 ORDER BY updated_at DESC LIMIT 1',
    [userId],
  );
  return rows[0] ? mapProvider(rows[0]) : null;
}

async function syncRuntimeAgent(input: {
  userId: string;
  lobsterId: string;
  lobsterName: string;
  modelRef: string;
  existingRuntimeAgentId?: string;
}) {
  const runtimeAgentId = input.existingRuntimeAgentId || buildRuntimeAgentId(input.userId, input.lobsterId);
  try {
    if (input.existingRuntimeAgentId) {
      await saveAgentBindings(runtimeAgentId, { primaryModelId: input.modelRef });
    } else {
      await saveAgent({
        id: runtimeAgentId,
        name: input.lobsterName,
        primaryModelId: input.modelRef,
        source: 'manual',
        notes: `platform-user:${input.userId}`,
        tags: ['platform'],
      });
    }
    return {
      runtimeAgentId,
      runtimeSyncStatus: 'synced' as const,
      runtimeSyncError: '',
    };
  } catch (error) {
    return {
      runtimeAgentId,
      runtimeSyncStatus: 'failed' as const,
      runtimeSyncError: error instanceof Error ? error.message : 'Runtime sync failed',
    };
  }
}

export async function findUserByEmail(email: string) {
  await ensurePlatformSchema();
  const pool = getPlatformPool();
  const [rows] = await pool.query<UserRow[]>(
    'SELECT * FROM platform_users WHERE email = ? LIMIT 1',
    [normalizeEmail(email)],
  );
  return rows[0] || null;
}

export async function createPlatformUser(input: {
  email: string;
  displayName: string;
  password: string;
}) {
  await ensurePlatformSchema();
  const pool = getPlatformPool();
  const email = normalizeEmail(input.email);
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('该邮箱已注册');
  }

  const userId = randomUUID();
  const displayName = input.displayName.trim() || email.split('@')[0] || 'OpenClaw 用户';
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute<ResultSetHeader>(
      `INSERT INTO platform_users (id, email, display_name, password_hash, role, status)
       VALUES (?, ?, ?, ?, 'user', 'active')`,
      [userId, email, displayName, await hashPassword(input.password)],
    );

    const modelRef = await resolveInitialModelRef();
    const lobsterId = randomUUID();
    const runtime = await syncRuntimeAgent({
      userId,
      lobsterId,
      lobsterName: `${displayName} 的龙虾`,
      modelRef,
    });

    await connection.execute<ResultSetHeader>(
      `INSERT INTO platform_lobsters (
        id, user_id, name, archetype, persona_summary, model_ref, provider_id,
        runtime_agent_id, runtime_sync_status, runtime_sync_error, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1)`,
      [
        lobsterId,
        userId,
        `${displayName} 的龙虾`,
        '默认原型',
        '注册即送的默认龙虾，可继续训练与扩展能力。',
        modelRef,
        runtime.runtimeAgentId,
        runtime.runtimeSyncStatus,
        runtime.runtimeSyncError || null,
      ],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const created = await findUserByEmail(email);
  if (!created) {
    throw new Error('用户创建失败');
  }
  return mapUser(created);
}

export async function authenticatePlatformUser(input: {
  email: string;
  password: string;
}) {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw new Error('邮箱或密码错误');
  }
  if (user.status !== 'active') {
    throw new Error('该账号已被禁用');
  }
  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) {
    throw new Error('邮箱或密码错误');
  }
  const pool = getPlatformPool();
  await pool.execute('UPDATE platform_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
  return mapUser(user);
}

export async function createPlatformSession(userId: string) {
  await ensurePlatformSchema();
  const pool = getPlatformPool();
  const sessionId = randomBytes(32).toString('hex');
  const ttlDays = getPlatformEnv().OPENCLAW_PLATFORM_SESSION_TTL_DAYS;
  await pool.execute(
    'INSERT INTO platform_sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
    [sessionId, userId, ttlDays],
  );
  return sessionId;
}

export async function getPlatformSession(sessionId: string) {
  if (!sessionId) return null;
  await ensurePlatformSchema();
  const pool = getPlatformPool();
  const [rows] = await pool.query<SessionRow[]>(
    `SELECT s.id AS session_id, s.expires_at, u.*
       FROM platform_sessions s
       JOIN platform_users u ON u.id = s.user_id
      WHERE s.id = ?
        AND s.expires_at > NOW()
      LIMIT 1`,
    [sessionId],
  );

  const row = rows[0];
  if (!row) return null;

  await pool.execute('UPDATE platform_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?', [sessionId]);
  return {
    id: row.session_id,
    expiresAt: toIso(row.expires_at) || new Date().toISOString(),
    user: mapUser(row as unknown as UserRow),
  } satisfies PlatformSessionRecord;
}

export async function deletePlatformSession(sessionId: string) {
  if (!sessionId) return;
  await ensurePlatformSchema();
  await getPlatformPool().execute('DELETE FROM platform_sessions WHERE id = ?', [sessionId]);
}

export async function listPlatformLobsters(userId: string) {
  await ensurePlatformSchema();
  const [rows] = await getPlatformPool().query<LobsterRow[]>(
    'SELECT * FROM platform_lobsters WHERE user_id = ? ORDER BY is_default DESC, created_at ASC',
    [userId],
  );
  return rows.map(mapLobster);
}

export async function getPlatformLobster(userId: string, lobsterId: string) {
  await ensurePlatformSchema();
  const [rows] = await getPlatformPool().query<LobsterRow[]>(
    'SELECT * FROM platform_lobsters WHERE id = ? AND user_id = ? LIMIT 1',
    [lobsterId, userId],
  );
  return rows[0] ? mapLobster(rows[0]) : null;
}

export async function createPlatformLobster(input: {
  userId: string;
  name: string;
  archetype: string;
}) {
  await ensurePlatformSchema();
  const defaultProvider = await loadDefaultProviderForUser(input.userId);
  const modelRef = defaultProvider?.runtimeModelRef || (await resolveInitialModelRef());
  const providerId = defaultProvider?.id || null;
  const lobsterId = randomUUID();
  const runtime = await syncRuntimeAgent({
    userId: input.userId,
    lobsterId,
    lobsterName: input.name,
    modelRef,
  });

  await getPlatformPool().execute<ResultSetHeader>(
    `INSERT INTO platform_lobsters (
      id, user_id, name, archetype, persona_summary, model_ref, provider_id,
      runtime_agent_id, runtime_sync_status, runtime_sync_error, is_default
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      lobsterId,
      input.userId,
      input.name.trim(),
      input.archetype.trim() || '自定义龙虾',
      '由平台工作台手动孵化的新龙虾。',
      modelRef,
      providerId,
      runtime.runtimeAgentId,
      runtime.runtimeSyncStatus,
      runtime.runtimeSyncError || null,
    ],
  );

  const [rows] = await getPlatformPool().query<LobsterRow[]>(
    'SELECT * FROM platform_lobsters WHERE id = ? LIMIT 1',
    [lobsterId],
  );
  return mapLobster(rows[0]);
}

export async function updatePlatformLobster(input: {
  userId: string;
  lobsterId: string;
  name: string;
  archetype: string;
}) {
  await ensurePlatformSchema();
  const pool = getPlatformPool();
  const [rows] = await pool.query<LobsterRow[]>(
    'SELECT * FROM platform_lobsters WHERE id = ? AND user_id = ? LIMIT 1',
    [input.lobsterId, input.userId],
  );
  const lobster = rows[0];
  if (!lobster) {
    throw new Error('龙虾不存在');
  }

  let runtimeAgentId = lobster.runtime_agent_id || '';
  let runtimeSyncStatus: 'pending' | 'synced' | 'failed' = 'pending';
  let runtimeSyncError = '';

  try {
    if (lobster.runtime_agent_id) {
      await saveAgent({
        id: lobster.runtime_agent_id,
        name: input.name.trim(),
        primaryModelId: lobster.model_ref,
        source: 'manual',
        notes: `platform-user:${input.userId}`,
        tags: ['platform'],
      });
      runtimeAgentId = lobster.runtime_agent_id;
      runtimeSyncStatus = 'synced';
    } else {
      const runtime = await syncRuntimeAgent({
        userId: input.userId,
        lobsterId: lobster.id,
        lobsterName: input.name.trim(),
        modelRef: lobster.model_ref,
      });
      runtimeAgentId = runtime.runtimeAgentId;
      runtimeSyncStatus = runtime.runtimeSyncStatus;
      runtimeSyncError = runtime.runtimeSyncError || '';
    }
  } catch (error) {
    runtimeAgentId = lobster.runtime_agent_id || runtimeAgentId;
    runtimeSyncStatus = 'failed';
    runtimeSyncError = error instanceof Error ? error.message : '运行态同步失败';
  }

  await pool.execute(
    `UPDATE platform_lobsters
        SET name = ?, archetype = ?, persona_summary = ?, runtime_agent_id = ?, runtime_sync_status = ?, runtime_sync_error = ?
      WHERE id = ? AND user_id = ?`,
    [
      input.name.trim(),
      input.archetype.trim() || '自定义龙虾',
      `用户维护的龙虾：${input.name.trim()}`,
      runtimeAgentId || null,
      runtimeSyncStatus,
      runtimeSyncError || null,
      input.lobsterId,
      input.userId,
    ],
  );

  const [nextRows] = await pool.query<LobsterRow[]>(
    'SELECT * FROM platform_lobsters WHERE id = ? LIMIT 1',
    [input.lobsterId],
  );
  return mapLobster(nextRows[0]);
}

export async function deletePlatformLobster(input: { userId: string; lobsterId: string }) {
  await ensurePlatformSchema();
  const pool = getPlatformPool();
  const [rows] = await pool.query<LobsterRow[]>(
    'SELECT * FROM platform_lobsters WHERE id = ? AND user_id = ? LIMIT 1',
    [input.lobsterId, input.userId],
  );
  const lobster = rows[0];
  if (!lobster) {
    throw new Error('龙虾不存在');
  }

  if (lobster.runtime_agent_id) {
    await deleteAgent(lobster.runtime_agent_id);
  }

  await pool.execute('DELETE FROM platform_lobsters WHERE id = ? AND user_id = ?', [input.lobsterId, input.userId]);

  if (Boolean(lobster.is_default)) {
    const [remaining] = await pool.query<LobsterRow[]>(
      'SELECT * FROM platform_lobsters WHERE user_id = ? ORDER BY created_at ASC LIMIT 1',
      [input.userId],
    );
    if (remaining[0]) {
      await pool.execute('UPDATE platform_lobsters SET is_default = 0 WHERE user_id = ?', [input.userId]);
      await pool.execute('UPDATE platform_lobsters SET is_default = 1 WHERE id = ? AND user_id = ?', [remaining[0].id, input.userId]);
    }
  }
}


export async function deletePlatformLobstersByRuntimeAgentId(runtimeAgentId: string) {
  await ensurePlatformSchema();
  const pool = getPlatformPool();
  const [rows] = await pool.query<LobsterRow[]>(
    'SELECT * FROM platform_lobsters WHERE runtime_agent_id = ?',
    [runtimeAgentId],
  );
  if (!rows.length) {
    return { deleted: 0, userIds: [] as string[] };
  }

  await pool.execute('DELETE FROM platform_lobsters WHERE runtime_agent_id = ?', [runtimeAgentId]);

  const affectedUserIds = Array.from(new Set(rows.map((row) => row.user_id)));
  for (const userId of affectedUserIds) {
    const [remaining] = await pool.query<LobsterRow[]>(
      'SELECT * FROM platform_lobsters WHERE user_id = ? ORDER BY is_default DESC, created_at ASC',
      [userId],
    );
    if (!remaining.length) {
      continue;
    }
    const currentDefault = remaining.find((row) => Boolean(row.is_default));
    if (currentDefault) {
      continue;
    }
    await pool.execute('UPDATE platform_lobsters SET is_default = 0 WHERE user_id = ?', [userId]);
    await pool.execute('UPDATE platform_lobsters SET is_default = 1 WHERE id = ? AND user_id = ?', [remaining[0].id, userId]);
  }

  return { deleted: rows.length, userIds: affectedUserIds };
}

export async function listPlatformProviders(userId: string) {
  await ensurePlatformSchema();
  const [rows] = await getPlatformPool().query<ProviderRow[]>(
    'SELECT * FROM platform_providers WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
    [userId],
  );
  return rows.map(mapProvider);
}

export async function createPlatformProvider(input: {
  userId: string;
  name: string;
  type: 'openai-compatible' | 'anthropic' | 'gemini' | 'ollama';
  baseUrl: string;
  apiKey: string;
  modelId: string;
  modelName: string;
  isDefault: boolean;
}) {
  await ensurePlatformSchema();
  const pool = getPlatformPool();
  const providerId = randomUUID();
  const runtimeProviderId = buildRuntimeProviderId(input.userId, input.name);
  const runtimeModelRef = `${runtimeProviderId}/${input.modelId}`;

  let syncStatus: 'pending' | 'synced' | 'failed' = 'pending';
  let syncError = '';

  try {
    await saveProvider({
      id: runtimeProviderId,
      name: input.name,
      type: input.type,
      baseUrl: input.baseUrl,
      apiKey: input.apiKey,
      enabled: true,
      isDefault: false,
      modelId: input.modelId,
      modelName: input.modelName || input.modelId,
      models: [{ id: input.modelId, name: input.modelName || input.modelId }],
      defaultModelId: input.modelId,
      websiteUrl: '',
      notes: `platform-user:${input.userId}`,
    });
    syncStatus = 'synced';
  } catch (error) {
    syncStatus = 'failed';
    syncError = error instanceof Error ? error.message : 'Provider 同步失败';
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    if (input.isDefault) {
      await connection.execute('UPDATE platform_providers SET is_default = 0 WHERE user_id = ?', [input.userId]);
    }
    await connection.execute<ResultSetHeader>(
      `INSERT INTO platform_providers (
        id, user_id, name, type, base_url, api_key_encrypted, model_id, model_name,
        runtime_provider_id, runtime_model_ref, sync_status, sync_error, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        providerId,
        input.userId,
        input.name.trim(),
        input.type,
        input.baseUrl.trim(),
        encryptSecret(input.apiKey.trim()),
        input.modelId.trim(),
        (input.modelName.trim() || input.modelId.trim()),
        runtimeProviderId,
        runtimeModelRef,
        syncStatus,
        syncError || null,
        input.isDefault ? 1 : 0,
      ],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const [rows] = await pool.query<ProviderRow[]>(
    'SELECT * FROM platform_providers WHERE id = ? LIMIT 1',
    [providerId],
  );
  return mapProvider(rows[0]);
}

export async function bindLobsterModel(input: {
  userId: string;
  lobsterId: string;
  modelRef: string;
  providerId?: string;
}) {
  await ensurePlatformSchema();
  const pool = getPlatformPool();
  const [rows] = await pool.query<LobsterRow[]>(
    'SELECT * FROM platform_lobsters WHERE id = ? AND user_id = ? LIMIT 1',
    [input.lobsterId, input.userId],
  );
  const lobster = rows[0];
  if (!lobster) {
    throw new Error('龙虾不存在');
  }

  let providerId = input.providerId || null;
  if (!providerId) {
    const [providerRows] = await pool.query<ProviderRow[]>(
      'SELECT * FROM platform_providers WHERE user_id = ? AND runtime_model_ref = ? LIMIT 1',
      [input.userId, input.modelRef],
    );
    providerId = providerRows[0]?.id || null;
  }

  const runtime = await syncRuntimeAgent({
    userId: input.userId,
    lobsterId: lobster.id,
    lobsterName: lobster.name,
    modelRef: input.modelRef,
    existingRuntimeAgentId: lobster.runtime_agent_id || undefined,
  });

  await pool.execute(
    `UPDATE platform_lobsters
        SET model_ref = ?, provider_id = ?, runtime_agent_id = ?, runtime_sync_status = ?, runtime_sync_error = ?
      WHERE id = ? AND user_id = ?`,
    [
      input.modelRef,
      providerId,
      runtime.runtimeAgentId,
      runtime.runtimeSyncStatus,
      runtime.runtimeSyncError || null,
      input.lobsterId,
      input.userId,
    ],
  );

  const [nextRows] = await pool.query<LobsterRow[]>(
    'SELECT * FROM platform_lobsters WHERE id = ? LIMIT 1',
    [input.lobsterId],
  );
  return mapLobster(nextRows[0]);
}

export async function listSharedRuntimeModels() {
  const models = await listModels();
  return models
    .filter((item) => !item.providerId.startsWith('tenant_'))
    .map((item) => ({
      id: item.id,
      label: item.isDefault ? `${item.displayName}（平台默认）` : `${item.displayName} · ${item.providerId}`,
      type: 'shared' as const,
    }));
}

export async function listAvailableModelChoices(userId: string): Promise<SharedModelChoice[]> {
  const [shared, providers] = await Promise.all([
    listSharedRuntimeModels(),
    listPlatformProviders(userId),
  ]);

  return [
    ...shared,
    ...providers
      .filter((item) => item.syncStatus === 'synced')
      .map((item) => ({
        id: item.runtimeModelRef,
        label: `${item.name} · ${item.modelName}（我的模型）`,
        type: 'private' as const,
      })),
  ];
}

export async function getPlatformDashboard(userId: string) {
  const [lobsters, providers] = await Promise.all([
    listPlatformLobsters(userId),
    listPlatformProviders(userId),
  ]);

  return {
    lobsterCount: lobsters.length,
    syncedLobsterCount: lobsters.filter((item) => item.runtimeSyncStatus === 'synced').length,
    providerCount: providers.length,
    syncedProviderCount: providers.filter((item) => item.syncStatus === 'synced').length,
    defaultLobster: lobsters.find((item) => item.isDefault) || lobsters[0] || null,
    recentLobsters: lobsters.slice(0, 5),
    recentProviders: providers.slice(0, 5),
  };
}

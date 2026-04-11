import { getPlatformEnv } from "./platform-env";
import { logActivity } from "./activity";
import { appendTaskLog, updateTask } from "./tasks";

interface ClawSwarmAuthUserRead {
  id: string;
  username: string;
  display_name: string;
  using_default_password: boolean;
}

interface ClawSwarmInstanceRead {
  id: number;
  status: string;
}

interface ClawSwarmSession {
  baseUrl: string;
  cookieHeader: string;
}

export interface PlatformClawSwarmSyncResult {
  skipped: boolean;
  totalInstances: number;
  syncedInstanceIds: number[];
  failedInstanceIds: number[];
  errorMessages: string[];
}

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

async function createClawSwarmSession(): Promise<ClawSwarmSession> {
  const env = getPlatformEnv();
  const baseUrl = trimTrailingSlash(env.OPENCLAW_CLAWSWARM_INTERNAL_URL);
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: env.OPENCLAW_CLAWSWARM_USERNAME,
      password: env.OPENCLAW_CLAWSWARM_PASSWORD,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  const payload = (await response.json().catch(() => ({}))) as ClawSwarmAuthUserRead | { detail?: string };
  const cookieHeader = (response.headers.get('set-cookie') || '').split(';', 1)[0]?.trim();

  if (!response.ok || !cookieHeader || !(payload && typeof payload === 'object' && 'username' in payload)) {
    throw new Error(buildErrorMessage(response, payload, 'ClawSwarm 登录失败，无法同步运行时目录'));
  }

  return { baseUrl, cookieHeader };
}

async function fetchClawSwarmJson<T>(session: ClawSwarmSession, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${session.baseUrl}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      cookie: session.cookieHeader,
      ...(init?.headers || {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T | { detail?: string };
  if (!response.ok) {
    throw new Error(buildErrorMessage(response, payload, `ClawSwarm 请求失败：${path}`));
  }
  return payload as T;
}

export async function syncPlatformClawSwarmInstances(): Promise<PlatformClawSwarmSyncResult> {
  const env = getPlatformEnv();
  if (!env.OPENCLAW_CLAWSWARM_ENABLED) {
    return {
      skipped: true,
      totalInstances: 0,
      syncedInstanceIds: [],
      failedInstanceIds: [],
      errorMessages: ['ClawSwarm 集成已关闭，跳过同步。'],
    };
  }

  const session = await createClawSwarmSession();
  const instances = await fetchClawSwarmJson<ClawSwarmInstanceRead[]>(session, '/api/instances');
  const syncedInstanceIds: number[] = [];
  const failedInstanceIds: number[] = [];
  const errorMessages: string[] = [];

  for (const instance of instances) {
    try {
      await fetchClawSwarmJson(session, `/api/instances/${instance.id}/sync-agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10000),
      });
      syncedInstanceIds.push(instance.id);
    } catch (error) {
      failedInstanceIds.push(instance.id);
      errorMessages.push(error instanceof Error ? error.message : `实例 ${instance.id} 同步失败`);
    }
  }

  return {
    skipped: false,
    totalInstances: instances.length,
    syncedInstanceIds,
    failedInstanceIds,
    errorMessages,
  };
}


export async function runPlatformClawSwarmSyncTask(taskId: string) {
  await updateTask(taskId, {
    status: 'running',
    startedAt: new Date().toISOString(),
    progress: 10,
    summary: '正在同步 ClawSwarm 运行时目录',
    error: undefined,
  });
  await appendTaskLog(taskId, '开始同步 ClawSwarm 实例与通讯录');

  try {
    const result = await syncPlatformClawSwarmInstances();

    if (result.skipped) {
      const summary = result.errorMessages[0] || 'ClawSwarm 集成已关闭，跳过同步。';
      await appendTaskLog(taskId, summary);
      const nextTask = await updateTask(taskId, {
        status: 'succeeded',
        finishedAt: new Date().toISOString(),
        progress: 100,
        summary,
      });
      await logActivity({
        action: 'clawswarm.sync',
        targetType: 'runtime',
        targetId: 'clawswarm',
        status: 'succeeded',
        summary,
      });
      return nextTask;
    }

    await appendTaskLog(taskId, `发现 ${result.totalInstances} 个 ClawSwarm 实例`);
    if (result.syncedInstanceIds.length) {
      await appendTaskLog(taskId, `同步成功实例：${result.syncedInstanceIds.join(', ')}`);
    }
    if (result.failedInstanceIds.length) {
      await appendTaskLog(taskId, `同步失败实例：${result.failedInstanceIds.join(', ')}`);
    }
    for (const message of result.errorMessages) {
      await appendTaskLog(taskId, `error: ${message}`);
    }

    const failed = result.failedInstanceIds.length > 0;
    const summary = failed
      ? `已同步 ${result.syncedInstanceIds.length}/${result.totalInstances} 个实例，${result.failedInstanceIds.length} 个失败。`
      : `已同步 ${result.syncedInstanceIds.length} 个实例，ClawSwarm 通讯录已刷新。`;

    const nextTask = await updateTask(taskId, {
      status: failed ? 'failed' : 'succeeded',
      finishedAt: new Date().toISOString(),
      progress: 100,
      summary,
      error: failed ? result.errorMessages.join('；') || '部分实例同步失败' : undefined,
    });

    await logActivity({
      action: 'clawswarm.sync',
      targetType: 'runtime',
      targetId: 'clawswarm',
      status: failed ? 'failed' : 'succeeded',
      summary,
    });

    return nextTask;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ClawSwarm 同步失败';
    await appendTaskLog(taskId, `error: ${message}`);
    const nextTask = await updateTask(taskId, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      progress: 100,
      summary: 'ClawSwarm 同步失败',
      error: message,
    });
    await logActivity({
      action: 'clawswarm.sync',
      targetType: 'runtime',
      targetId: 'clawswarm',
      status: 'failed',
      summary: message,
    });
    return nextTask;
  }
}

import { spawn } from 'child_process';
import { getAdminPaths } from './paths';
import { appendTaskLog, updateTask } from './tasks';
import { logActivity } from './activity';

const SUPPORTED_ACTIONS = new Set(['start', 'stop', 'restart', 'recreate', 'build-recreate']);

function assertSafeComposeService(service: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(service)) {
    throw new Error(`Unsafe compose service: ${service}`);
  }
  return service;
}

const ANSI_PATTERN = /\u001B\[[0-?]*[ -/]*[@-~]/g;

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ComposePsItem {
  ID?: string;
  Name?: string;
  Service?: string;
  State?: string;
  Health?: string;
  Status?: string;
  ExitCode?: number;
  Publishers?: Array<{
    URL?: string;
    TargetPort?: number;
    PublishedPort?: number;
    Protocol?: string;
  }>;
}

export function resolveComposeServiceAction(service: string, action: string) {
  const safeService = assertSafeComposeService(service);
  if (!SUPPORTED_ACTIONS.has(action)) {
    throw new Error(`Unsupported admin action: ${action}`);
  }
  if (action === 'start') {
    return ['docker', 'compose', 'up', '-d', safeService];
  }
  if (action === 'stop') {
    return ['docker', 'compose', 'stop', safeService];
  }
  if (action === 'restart') {
    return ['docker', 'compose', 'restart', safeService];
  }
  if (action === 'recreate') {
    return ['docker', 'compose', 'up', '-d', '--force-recreate', safeService];
  }
  return ['docker', 'compose', 'up', '-d', '--build', '--force-recreate', safeService];
}

export function resolveComposeAction(action: string) {
  return resolveComposeServiceAction('openclaw-gateway', action);
}

export function stripAnsi(text: string) {
  return text.replace(ANSI_PATTERN, '');
}

export function runCommand(args: string[], cwd = getAdminPaths().repoRoot): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const [command, ...rest] = args;
    const child = spawn(command, rest, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      resolve({ exitCode: code ?? 0, stdout, stderr });
    });
  });
}

export function parseComposeJson(text: string): ComposePsItem[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[')) {
    return JSON.parse(trimmed) as ComposePsItem[];
  }

  return trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ComposePsItem);
}

export async function inspectComposeServices(): Promise<ComposePsItem[]> {
  const result = await runCommand(['docker', 'compose', 'ps', '--all', '--format', 'json']);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || 'Unable to inspect docker compose services');
  }
  return parseComposeJson(result.stdout);
}

export async function readComposeLogs(service = 'openclaw-gateway', tail = 120) {
  const result = await runCommand(['docker', 'compose', 'logs', '--tail', String(tail), service]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `Unable to read logs for ${service}`);
  }
  return stripAnsi(result.stdout);
}

export async function runComposeServiceActionTask(
  taskId: string,
  action: string,
  service = 'openclaw-gateway',
  activityPrefix = 'gateway',
  activitySummary = 'Gateway 控制命令执行成功',
) {
  const command = resolveComposeServiceAction(service, action);
  const label = command.join(' ');

  await updateTask(taskId, {
    status: 'running',
    startedAt: new Date().toISOString(),
    progress: 10,
    summary: `执行中：${label}`
  });
  await appendTaskLog(taskId, `command: ${label}`);

  try {
    const result = await runCommand(command);
    const combined = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n');

    if (combined) {
      await appendTaskLog(taskId, stripAnsi(combined));
    }

    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || `command exited with ${result.exitCode}`);
    }

    await updateTask(taskId, {
      status: 'succeeded',
      finishedAt: new Date().toISOString(),
      progress: 100,
      summary: `执行成功：${action}`
    });
    await logActivity({
      action: `${activityPrefix}.${action}`,
      targetType: 'service',
      targetId: service,
      status: 'succeeded',
      summary: activitySummary
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    await appendTaskLog(taskId, `error: ${message}`);
    await updateTask(taskId, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      progress: 100,
      error: message,
      summary: `执行失败：${action}`
    });
    await logActivity({
      action: `${activityPrefix}.${action}`,
      targetType: 'service',
      targetId: service,
      status: 'failed',
      summary: message
    });
    throw error;
  }
}

export async function runComposeActionTask(taskId: string, action: string) {
  return runComposeServiceActionTask(taskId, action, 'openclaw-gateway', 'gateway', 'Gateway 控制命令执行成功');
}

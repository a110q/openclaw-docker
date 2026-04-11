import { readOpenClawConfig, writeOpenClawConfig } from './config-files';
import { runCommand, stripAnsi } from './compose';
import type { SandboxContainerSummary } from '../types/admin';

export interface SandboxResourcePolicy {
  cpus?: number;
  memory?: string;
  memorySwap?: string;
  pidsLimit?: number;
}

interface OpenClawConfig {
  agents?: {
    defaults?: {
      sandbox?: {
        docker?: {
          cpus?: number;
          memory?: string | number;
          memorySwap?: string | number;
          pidsLimit?: number;
        };
      };
    };
  };
}

interface DockerInspectItem {
  Id?: string;
  Name?: string;
  Created?: string;
  State?: { Status?: string };
  Config?: { Labels?: Record<string, string> };
  HostConfig?: {
    Memory?: number;
    MemorySwap?: number;
    NanoCpus?: number;
    PidsLimit?: number;
    NetworkMode?: string;
  };
}

interface DockerStatsItem {
  ID?: string;
  Name?: string;
  CPUPerc?: string;
  MemUsage?: string;
}

function normalizeOptionalString(value: string | number | undefined) {
  if (value == null) return undefined;
  const next = String(value).trim();
  return next ? next : undefined;
}

function normalizeReportedMemoryLimit(value: string | undefined) {
  const next = normalizeOptionalString(value)?.toLowerCase();
  if (!next || next in {'0b': 1, '0.0b': 1, '0.00b': 1}) return undefined;
  return value?.trim();
}

function assertSandboxContainerName(name: string) {
  const next = name.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(next)) {
    throw new Error('非法的沙箱容器名称');
  }
  return next;
}

function normalizeCpuLimit(value: unknown) {
  if (value == null || value === '') return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('CPU 限额必须大于 0');
  }
  return Number(numeric.toFixed(2));
}

function normalizePositiveInteger(value: unknown, label: string) {
  if (value == null || value === '') return undefined;
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error(`${label}必须是正整数`);
  }
  return numeric;
}

function normalizeMemoryLimit(value: unknown, label: string) {
  if (value == null || value === '') return undefined;
  const next = String(value).trim();
  if (!next) return undefined;
  if (next === '-1' && label === '交换内存') return next;
  if (!/^\d+(?:[bkmgBKMG])?$/.test(next)) {
    throw new Error(`${label}格式不正确，示例：512m、1g、2048`);
  }
  return next.toLowerCase();
}

function parsePolicy(input: Partial<SandboxResourcePolicy>) {
  return {
    cpus: normalizeCpuLimit(input.cpus),
    memory: normalizeMemoryLimit(input.memory, '内存上限'),
    memorySwap: normalizeMemoryLimit(input.memorySwap, '交换内存'),
    pidsLimit: normalizePositiveInteger(input.pidsLimit, 'PIDs 上限'),
  } satisfies SandboxResourcePolicy;
}

export function normalizeSandboxResourcePolicy(input: Partial<SandboxResourcePolicy>) {
  return parsePolicy(input);
}

export function hasSandboxResourcePolicy(policy: Partial<SandboxResourcePolicy> | undefined | null) {
  return Boolean(
    policy &&
      (policy.cpus != null ||
        policy.memory != null ||
        policy.memorySwap != null ||
        policy.pidsLimit != null),
  );
}

export function sanitizeSandboxPolicyForConfig(input: Partial<SandboxResourcePolicy>) {
  const policy = parsePolicy(input);
  return {
    ...(policy.cpus != null ? { cpus: policy.cpus } : {}),
    ...(policy.memory ? { memory: policy.memory } : {}),
    ...(policy.memorySwap ? { memorySwap: policy.memorySwap } : {}),
    ...(policy.pidsLimit != null ? { pidsLimit: policy.pidsLimit } : {}),
  } satisfies SandboxResourcePolicy;
}

function bytesToHuman(value?: number) {
  if (!value || value <= 0) return '未限制';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let current = value;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current >= 100 ? current.toFixed(0) : current.toFixed(1)}${units[index]}`;
}

function parseDockerStats(stdout: string) {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as DockerStatsItem);
}

async function listSandboxContainerNames() {
  const result = await runCommand([
    'docker',
    'ps',
    '--all',
    '--filter',
    'label=openclaw.sandbox=1',
    '--format',
    '{{.Names}}',
  ]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || '读取沙箱容器列表失败');
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

async function inspectSandboxContainers(names: string[]) {
  if (!names.length) return [] as DockerInspectItem[];
  const result = await runCommand(['docker', 'inspect', ...names]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || '读取沙箱容器详情失败');
  }
  return JSON.parse(result.stdout) as DockerInspectItem[];
}

async function readSandboxStats(names: string[]) {
  if (!names.length) return [] as DockerStatsItem[];
  const result = await runCommand([
    'docker',
    'stats',
    '--no-stream',
    '--format',
    '{{json .}}',
    ...names,
  ]);
  if (result.exitCode !== 0) {
    return [] as DockerStatsItem[];
  }
  return parseDockerStats(result.stdout);
}

export async function readSandboxResourcePolicy(): Promise<SandboxResourcePolicy> {
  const config = await readOpenClawConfig<OpenClawConfig>();
  const docker = config.agents?.defaults?.sandbox?.docker;
  return {
    cpus: normalizeCpuLimit(docker?.cpus),
    memory: normalizeOptionalString(docker?.memory)?.toLowerCase(),
    memorySwap: normalizeOptionalString(docker?.memorySwap)?.toLowerCase(),
    pidsLimit: normalizePositiveInteger(docker?.pidsLimit, 'PIDs 上限'),
  };
}

export async function writeSandboxResourcePolicy(input: Partial<SandboxResourcePolicy>) {
  const policy = parsePolicy(input);
  const config = await readOpenClawConfig<OpenClawConfig>();
  config.agents ??= {};
  config.agents.defaults ??= {};
  config.agents.defaults.sandbox ??= {};
  config.agents.defaults.sandbox.docker ??= {};

  const docker = config.agents.defaults.sandbox.docker;
  if (policy.cpus != null) docker.cpus = policy.cpus; else delete docker.cpus;
  if (policy.memory) docker.memory = policy.memory; else delete docker.memory;
  if (policy.memorySwap) docker.memorySwap = policy.memorySwap; else delete docker.memorySwap;
  if (policy.pidsLimit != null) docker.pidsLimit = policy.pidsLimit; else delete docker.pidsLimit;

  await writeOpenClawConfig(config);
  return policy;
}

export async function readSandboxContainerSnapshot(): Promise<SandboxContainerSummary[]> {
  const names = await listSandboxContainerNames();
  const [inspectItems, statsItems] = await Promise.all([
    inspectSandboxContainers(names),
    readSandboxStats(names),
  ]);

  const statsByName = new Map(statsItems.map((item) => [item.Name || '', item]));

  return inspectItems
    .map((item) => {
      const name = item.Name?.replace(/^\//, '') || '';
      const stats = statsByName.get(name);
      const sessionKey = item.Config?.Labels?.['openclaw.sessionKey'];
      const memoryLimitBytes = item.HostConfig?.Memory || 0;
      const cpus = item.HostConfig?.NanoCpus
        ? item.HostConfig.NanoCpus / 1_000_000_000
        : 0;
      const memUsageRaw = stats?.MemUsage || '';
      const [memUsage = '', memLimit = ''] = memUsageRaw
        .split('/')
        .map((value) => value.trim());
      return {
        id: item.Id || name,
        shortId: (item.Id || '').slice(0, 12),
        name,
        sessionKey,
        agentId: sessionKey?.startsWith('agent:')
          ? sessionKey.slice('agent:'.length)
          : undefined,
        status: item.State?.Status || 'unknown',
        createdAt: item.Created,
        cpuUsage: normalizeOptionalString(stats?.CPUPerc),
        memoryUsage: normalizeOptionalString(memUsage),
        memoryLimit:
          normalizeReportedMemoryLimit(memLimit) || bytesToHuman(memoryLimitBytes),
        cpuLimit: cpus > 0 ? `${cpus}` : '未限制',
        pidsLimit:
          item.HostConfig?.PidsLimit && item.HostConfig.PidsLimit > 0
            ? item.HostConfig.PidsLimit
            : undefined,
        networkMode: item.HostConfig?.NetworkMode,
      } satisfies SandboxContainerSummary;
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
}

function buildDockerUpdateArgs(policy: SandboxResourcePolicy) {
  const args = ['docker', 'update'];
  if (policy.cpus != null) args.push('--cpus', String(policy.cpus));
  if (policy.memory) args.push('--memory', policy.memory);
  if (policy.memorySwap) args.push('--memory-swap', policy.memorySwap);
  if (policy.pidsLimit != null) {
    args.push('--pids-limit', String(policy.pidsLimit));
  }
  return args;
}

export async function applySandboxResourcesToAgentContainers(
  agentId: string,
  input: Partial<SandboxResourcePolicy>,
) {
  const policy = parsePolicy(input);
  const names = (await readSandboxContainerSnapshot())
    .filter((item) => item.agentId === agentId)
    .map((item) => item.name);

  if (!names.length) {
    return { updated: 0, names: [] as string[] };
  }

  const args = buildDockerUpdateArgs(policy);
  if (args.length === 2) {
    return { updated: 0, names };
  }

  const result = await runCommand([...args, ...names]);
  if (result.exitCode !== 0) {
    throw new Error(
      stripAnsi(result.stderr || result.stdout || '更新沙箱容器资源失败'),
    );
  }
  return { updated: names.length, names };
}

export async function removeSandboxContainersForAgent(agentId: string) {
  const names = (await readSandboxContainerSnapshot())
    .filter((item) => item.agentId === agentId)
    .map((item) => item.name);

  if (!names.length) {
    return { removed: 0, names: [] as string[] };
  }

  const result = await runCommand(['docker', 'rm', '-f', ...names]);
  if (result.exitCode !== 0) {
    throw new Error(stripAnsi(result.stderr || result.stdout || '删除沙箱容器失败'));
  }
  return { removed: names.length, names };
}
export async function restartSandboxContainer(name: string) {
  const containerName = assertSandboxContainerName(name);
  const result = await runCommand(['docker', 'restart', containerName]);
  if (result.exitCode !== 0) {
    throw new Error(stripAnsi(result.stderr || result.stdout || '重启沙箱容器失败'));
  }
  return { ok: true as const, name: containerName };
}

export async function removeSandboxContainer(name: string) {
  const containerName = assertSandboxContainerName(name);
  const result = await runCommand(['docker', 'rm', '-f', containerName]);
  if (result.exitCode !== 0) {
    throw new Error(stripAnsi(result.stderr || result.stdout || '删除沙箱容器失败'));
  }
  return { ok: true as const, name: containerName };
}

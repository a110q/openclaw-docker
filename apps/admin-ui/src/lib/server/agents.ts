import fs from "fs/promises";
import path from "path";
import { readJsonFile, writeJsonFile } from "./json-store";
import { readOpenClawConfig, writeOpenClawConfig } from "./config-files";
import { getAdminPaths } from "./paths";
import {
  buildAgentPathsFromRoots,
  isPathWithinHostDataRoot,
  resolveAgentStoragePaths,
  resolveAgentStorageRoots,
  sanitizeAgentStorageRelativePath,
} from "./agent-storage";
import { logActivity } from "./activity";
import { assertSafeAgentModel } from "./model-policy";
import { syncPlatformClawSwarmInstances } from "./platform-clawswarm-sync";
import {
  applySandboxResourcesToAgentContainers,
  hasSandboxResourcePolicy,
  normalizeSandboxResourcePolicy,
  readSandboxContainerSnapshot,
  sanitizeSandboxPolicyForConfig,
  type SandboxResourcePolicy,
  removeSandboxContainersForAgent,
} from "./sandbox-resources";
import type { ManagedAgent } from "@/lib/types/admin";

interface OpenClawSandboxDockerConfig {
  cpus?: number;
  memory?: string | number;
  memorySwap?: string | number;
  pidsLimit?: number;
  [key: string]: unknown;
}

interface OpenClawSandboxConfig {
  mode?: string;
  docker?: OpenClawSandboxDockerConfig;
  [key: string]: unknown;
}

interface OpenClawAgentConfig {
  id: string;
  default?: boolean;
  name?: string;
  workspace?: string;
  agentDir?: string;
  model?: { primary?: string };
  imageModel?: { primary?: string };
  sandbox?: OpenClawSandboxConfig;
}

interface OpenClawConfig {
  agents?: {
    defaults?: {
      model?: { primary?: string };
      imageModel?: { primary?: string };
      sandbox?: OpenClawSandboxConfig;
    };
    list?: OpenClawAgentConfig[];
  };
}

function normalizeDockerPolicy(
  docker?: OpenClawSandboxDockerConfig,
): SandboxResourcePolicy {
  return sanitizeSandboxPolicyForConfig({
    cpus: docker?.cpus,
    memory: docker?.memory != null ? String(docker.memory) : undefined,
    memorySwap:
      docker?.memorySwap != null ? String(docker.memorySwap) : undefined,
    pidsLimit: docker?.pidsLimit,
  });
}

function policiesEqual(
  left: Partial<SandboxResourcePolicy> | undefined,
  right: Partial<SandboxResourcePolicy> | undefined,
) {
  return JSON.stringify(left || {}) === JSON.stringify(right || {});
}

function policyRemovedKeys(
  previous: Partial<SandboxResourcePolicy>,
  next: Partial<SandboxResourcePolicy>,
) {
  return (["cpus", "memory", "memorySwap", "pidsLimit"] as const).filter(
    (key) => previous[key] != null && next[key] == null,
  );
}

function expandHostDataRootTemplate(value?: string) {
  if (!value) return "";
  const { hostDataRoot } = getAdminPaths();
  return value.replace(/^\$\{OPENCLAW_HOST_DATA_ROOT\}/, hostDataRoot);
}


function deriveRuntimeStatus(statuses: string[]) {
  const normalized = statuses.map((item) => item.trim().toLowerCase());
  if (normalized.some((item) => item === "running")) {
    return "running" as const;
  }
  if (
    normalized.some((item) =>
      ["created", "restarting", "paused"].includes(item),
    )
  ) {
    return "starting" as const;
  }
  if (
    normalized.some((item) => ["exited", "dead", "removing"].includes(item))
  ) {
    return "stopped" as const;
  }
  return "unknown" as const;
}

export function buildAgentBatch(input: {
  prefix: string;
  count: number;
  startIndex: number;
  workspaceRoot: string;
  agentDirRoot: string;
}) {
  return Array.from({ length: input.count }, (_, offset) => {
    const numeric = String(input.startIndex + offset).padStart(3, "0");
    const name = `${input.prefix}-${numeric}`;
    return {
      id: name,
      name,
      displayName: name,
      source: "batch-created" as const,
      ...buildAgentPathsFromRoots({
        agentId: name,
        workspaceRoot: input.workspaceRoot,
        agentDirRoot: input.agentDirRoot,
      }),
      primaryModelId: "",
      tags: [] as string[],
    };
  });
}

async function ensureAgentDirs(agent: {
  workspacePath: string;
  agentDirPath: string;
}) {
  await fs.mkdir(agent.workspacePath, { recursive: true });
  await fs.mkdir(agent.agentDirPath, { recursive: true });
}

function resolveManagedAbsolutePath(input: {
  rawPath?: string;
  fallbackPath: string;
  label: string;
}) {
  const trimmed = input.rawPath?.trim() || "";
  if (!trimmed) {
    return input.fallbackPath;
  }

  const { hostDataRoot } = getAdminPaths();
  if (path.isAbsolute(trimmed) || /^[A-Za-z]:[\\/]/.test(trimmed)) {
    const absolute = path.normalize(trimmed);
    if (!isPathWithinHostDataRoot(hostDataRoot, absolute)) {
      throw new Error(`${input.label}必须位于宿主机数据根目录下：${hostDataRoot}`);
    }
    return absolute;
  }

  const relative = sanitizeAgentStorageRelativePath(trimmed, "tmp");
  return path.join(hostDataRoot, relative);
}

async function resolveManagedAgentPaths(input: {
  agentId: string;
  workspacePath?: string;
  agentDirPath?: string;
}) {
  const defaults = await resolveAgentStoragePaths(input.agentId);
  return {
    workspacePath: resolveManagedAbsolutePath({
      rawPath: input.workspacePath,
      fallbackPath: defaults.workspacePath,
      label: "工作目录",
    }),
    agentDirPath: resolveManagedAbsolutePath({
      rawPath: input.agentDirPath,
      fallbackPath: defaults.agentDirPath,
      label: "Agent 数据目录",
    }),
  };
}

export async function readManagedAgents() {
  const { managedAgentsFile } = getAdminPaths();
  return readJsonFile<ManagedAgent[]>(managedAgentsFile, []);
}

async function writeManagedAgents(agents: ManagedAgent[]) {
  const { managedAgentsFile } = getAdminPaths();
  await writeJsonFile(managedAgentsFile, agents);
}

async function readAgentConfig() {
  return readOpenClawConfig<OpenClawConfig>();
}

async function writeAgentConfig(config: OpenClawConfig) {
  await writeOpenClawConfig(config);
}

function toManagedAgent(
  config: OpenClawAgentConfig,
  defaults: OpenClawConfig["agents"] extends infer A ? any : never,
  meta: ManagedAgent | undefined,
  runtimeStatus: ManagedAgent["runtimeStatus"],
): ManagedAgent {
  const defaultPrimary = defaults?.model?.primary || "";
  const defaultImage = defaults?.imageModel?.primary || "";
  const defaultSandboxPolicy = normalizeDockerPolicy(defaults?.sandbox?.docker);
  const agentSandboxPolicy = normalizeDockerPolicy(config.sandbox?.docker);
  const sandboxResourceSource = hasSandboxResourcePolicy(agentSandboxPolicy)
    ? "agent"
    : "default";
  const effectiveSandboxPolicy =
    sandboxResourceSource === "agent"
      ? agentSandboxPolicy
      : defaultSandboxPolicy;

  return {
    id: config.id,
    name: config.name || config.id,
    displayName: config.name || config.id,
    source: meta?.source || "manual",
    workspacePath: expandHostDataRootTemplate(config.workspace),
    agentDirPath: expandHostDataRootTemplate(config.agentDir),
    runtimeStatus,
    primaryModelId: config.model?.primary || defaultPrimary,
    imageModelId: config.imageModel?.primary || defaultImage,
    inheritsDefaultModel: !config.model?.primary,
    sandboxMode: config.sandbox?.mode || defaults?.sandbox?.mode || "all",
    sandboxResourceSource,
    sandboxCpuLimit: effectiveSandboxPolicy.cpus,
    sandboxMemoryLimit: effectiveSandboxPolicy.memory,
    sandboxMemorySwap: effectiveSandboxPolicy.memorySwap,
    sandboxPidsLimit: effectiveSandboxPolicy.pidsLimit,
    alertPolicyId: meta?.alertPolicyId,
    tags: meta?.tags || [],
    notes: meta?.notes,
    lastSeenAt: meta?.lastSeenAt,
    managed: true,
  };
}

export async function listAgents() {
  const [config, metaList, sandboxContainers] = await Promise.all([
    readAgentConfig(),
    readManagedAgents(),
    readSandboxContainerSnapshot().catch(() => []),
  ]);
  const defaults = config.agents?.defaults;
  const metaMap = new Map(metaList.map((item) => [item.id, item]));
  const statusesByAgent = new Map<string, string[]>();

  sandboxContainers.forEach((container) => {
    if (!container.agentId) return;
    const current = statusesByAgent.get(container.agentId) || [];
    current.push(container.status || "unknown");
    statusesByAgent.set(container.agentId, current);
  });

  return (config.agents?.list || []).map((item) =>
    toManagedAgent(
      item,
      defaults,
      metaMap.get(item.id),
      deriveRuntimeStatus(statusesByAgent.get(item.id) || []),
    ),
  );
}

export async function saveAgent(input: {
  id: string;
  name: string;
  primaryModelId: string;
  imageModelId?: string;
  source?: ManagedAgent["source"];
  notes?: string;
  tags?: string[];
  workspacePath?: string;
  agentDirPath?: string;
  sandboxCpuLimit?: string | number;
  sandboxMemoryLimit?: string;
  sandboxMemorySwap?: string;
  sandboxPidsLimit?: string | number;
}) {
  const config = await readAgentConfig();
  if (input.primaryModelId) {
    assertSafeAgentModel(config, input.primaryModelId);
  }

  config.agents ??= {};
  config.agents.list ??= [];
  const list = config.agents.list;
  const index = list.findIndex((item) => item.id === input.id);
  const previousConfig = index >= 0 ? list[index] : undefined;
  const previousMeta = (await readManagedAgents()).find((item) => item.id === input.id);

  const { workspacePath, agentDirPath } = await resolveManagedAgentPaths({
    agentId: input.id,
    workspacePath: input.workspacePath,
    agentDirPath: input.agentDirPath,
  });

  const nextAgentPolicy = normalizeSandboxResourcePolicy({
    cpus: input.sandboxCpuLimit as any,
    memory: input.sandboxMemoryLimit,
    memorySwap: input.sandboxMemorySwap,
    pidsLimit: input.sandboxPidsLimit as any,
  });
  const previousAgentPolicy = normalizeDockerPolicy(previousConfig?.sandbox?.docker);
  const defaultSandboxPolicy = normalizeDockerPolicy(
    config.agents?.defaults?.sandbox?.docker,
  );

  const nextConfig: OpenClawAgentConfig = {
    ...(previousConfig ?? {}),
    id: input.id,
    name: input.name,
    workspace: workspacePath,
    agentDir: agentDirPath,
    model: { primary: input.primaryModelId },
  };

  if (input.imageModelId) {
    nextConfig.imageModel = { primary: input.imageModelId };
  } else {
    delete nextConfig.imageModel;
  }

  const sandboxBase = previousConfig?.sandbox
    ? {
        ...previousConfig.sandbox,
        ...(previousConfig.sandbox.docker
          ? { docker: { ...previousConfig.sandbox.docker } }
          : {}),
      }
    : undefined;

  if (hasSandboxResourcePolicy(nextAgentPolicy)) {
    const sandbox = sandboxBase ?? {};
    const docker = { ...(sandbox.docker ?? {}) };
    if (nextAgentPolicy.cpus != null) docker.cpus = nextAgentPolicy.cpus;
    else delete docker.cpus;
    if (nextAgentPolicy.memory) docker.memory = nextAgentPolicy.memory;
    else delete docker.memory;
    if (nextAgentPolicy.memorySwap) {
      docker.memorySwap = nextAgentPolicy.memorySwap;
    } else {
      delete docker.memorySwap;
    }
    if (nextAgentPolicy.pidsLimit != null) {
      docker.pidsLimit = nextAgentPolicy.pidsLimit;
    } else {
      delete docker.pidsLimit;
    }
    sandbox.docker = docker;
    nextConfig.sandbox = sandbox;
  } else if (sandboxBase) {
    const sandbox = { ...sandboxBase };
    if (sandbox.docker) {
      const docker = { ...sandbox.docker };
      delete docker.cpus;
      delete docker.memory;
      delete docker.memorySwap;
      delete docker.pidsLimit;
      if (Object.keys(docker).length > 0) {
        sandbox.docker = docker;
      } else {
        delete sandbox.docker;
      }
    }
    if (Object.keys(sandbox).length > 0) {
      nextConfig.sandbox = sandbox;
    } else {
      delete nextConfig.sandbox;
    }
  } else {
    delete nextConfig.sandbox;
  }

  if (index >= 0) {
    list[index] = nextConfig;
  } else {
    list.push(nextConfig);
  }

  await writeAgentConfig(config);
  await ensureAgentDirs({ workspacePath, agentDirPath });

  const effectivePolicy = hasSandboxResourcePolicy(nextAgentPolicy)
    ? nextAgentPolicy
    : defaultSandboxPolicy;
  const nextManaged: ManagedAgent = {
    id: input.id,
    name: input.name,
    displayName: input.name,
    source: input.source || previousMeta?.source || "manual",
    workspacePath,
    agentDirPath,
    runtimeStatus: previousMeta?.runtimeStatus || "unknown",
    primaryModelId: input.primaryModelId,
    imageModelId: input.imageModelId,
    inheritsDefaultModel: false,
    sandboxMode:
      nextConfig.sandbox?.mode || config.agents?.defaults?.sandbox?.mode || "all",
    sandboxResourceSource: hasSandboxResourcePolicy(nextAgentPolicy)
      ? "agent"
      : "default",
    sandboxCpuLimit: effectivePolicy.cpus,
    sandboxMemoryLimit: effectivePolicy.memory,
    sandboxMemorySwap: effectivePolicy.memorySwap,
    sandboxPidsLimit: effectivePolicy.pidsLimit,
    tags: input.tags || previousMeta?.tags || [],
    notes: input.notes,
    managed: true,
  };

  const managed = await readManagedAgents();
  const nextManagedList = managed.some((item) => item.id === input.id)
    ? managed.map((item) =>
        item.id === input.id ? { ...item, ...nextManaged } : item,
      )
    : [nextManaged, ...managed];
  await writeManagedAgents(nextManagedList);

  const storageChanged =
    expandHostDataRootTemplate(previousConfig?.workspace) !== workspacePath ||
    expandHostDataRootTemplate(previousConfig?.agentDir) !== agentDirPath;
  const policyChanged = !policiesEqual(previousAgentPolicy, nextAgentPolicy);
  const removedKeys = policyRemovedKeys(previousAgentPolicy, nextAgentPolicy);

  if (storageChanged) {
    await removeSandboxContainersForAgent(input.id);
  } else if (policyChanged) {
    if (removedKeys.length > 0) {
      await removeSandboxContainersForAgent(input.id);
    } else if (hasSandboxResourcePolicy(nextAgentPolicy)) {
      await applySandboxResourcesToAgentContainers(input.id, nextAgentPolicy);
    }
  }

  await logActivity({
    action: "agent.save",
    targetType: "agent",
    targetId: input.id,
    status: "succeeded",
    summary: `保存 Agent ${input.id}`,
  });

  return (await listAgents()).find((item) => item.id === input.id) || nextManaged;
}

export async function deleteAgent(agentId: string) {
  await removeSandboxContainersForAgent(agentId);

  const config = await readAgentConfig();
  const current = config.agents?.list || [];
  config.agents ??= {};
  config.agents.list = current.filter((item) => item.id !== agentId);
  await writeAgentConfig(config);
  await writeManagedAgents(
    (await readManagedAgents()).filter((item) => item.id !== agentId),
  );

  const clawswarmSync = await syncPlatformClawSwarmInstances().catch((error) => ({
    skipped: false,
    totalInstances: 0,
    syncedInstanceIds: [],
    failedInstanceIds: [],
    errorMessages: [error instanceof Error ? error.message : 'ClawSwarm 同步失败'],
  }));

  await logActivity({
    action: "agent.delete",
    targetType: "agent",
    targetId: agentId,
    status: "succeeded",
    summary: `删除 Agent ${agentId}`,
  });

  if (clawswarmSync.errorMessages.length > 0) {
    await logActivity({
      action: "clawswarm.sync",
      targetType: "runtime",
      targetId: "clawswarm",
      status: "failed",
      summary: `删除 Agent ${agentId} 后同步 ClawSwarm 失败：${clawswarmSync.errorMessages.join('；')}`,
    });
  }
}

export async function saveAgentBindings(
  agentId: string,
  bindings: { primaryModelId: string; imageModelId?: string },
) {
  const config = await readAgentConfig();
  assertSafeAgentModel(config, bindings.primaryModelId);
  const list = config.agents?.list || [];
  const target = list.find((item) => item.id === agentId);
  if (!target) {
    throw new Error(`Agent not found: ${agentId}`);
  }
  target.model = { primary: bindings.primaryModelId };
  if (bindings.imageModelId) {
    target.imageModel = { primary: bindings.imageModelId };
  } else {
    delete target.imageModel;
  }
  await writeAgentConfig(config);

  const managed = await readManagedAgents();
  const nextManaged = managed.map((item) =>
    item.id === agentId
      ? {
          ...item,
          primaryModelId: bindings.primaryModelId,
          imageModelId: bindings.imageModelId,
          inheritsDefaultModel: false,
        }
      : item,
  );
  await writeManagedAgents(nextManaged);
  await logActivity({
    action: "agent.bindings.save",
    targetType: "agent",
    targetId: agentId,
    status: "succeeded",
    summary: `更新 Agent ${agentId} 模型绑定`,
  });
  return (await listAgents()).find((item) => item.id === agentId);
}

export async function createAgentBatch(input: {
  prefix: string;
  count: number;
  startIndex: number;
  primaryModelId: string;
  imageModelId?: string;
  notes?: string;
}) {
  const roots = await resolveAgentStorageRoots();
  const batch = buildAgentBatch({
    prefix: input.prefix,
    count: input.count,
    startIndex: input.startIndex,
    workspaceRoot: roots.workspaceRootAbsolute,
    agentDirRoot: roots.agentDirRootAbsolute,
  });

  const created: ManagedAgent[] = [];
  for (const item of batch) {
    created.push(
      await saveAgent({
        id: item.id,
        name: item.name,
        primaryModelId: input.primaryModelId,
        imageModelId: input.imageModelId,
        source: "batch-created",
        notes: input.notes,
        tags: [],
      }),
    );
  }
  return created;
}

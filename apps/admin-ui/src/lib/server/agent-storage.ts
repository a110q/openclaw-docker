import fs from "fs/promises";
import path from "path";
import { getAdminPaths } from "./paths";
import { readAdminSettings, writeAdminSettings } from "./settings";

export interface AgentStorageSettings {
  workspaceRoot: string;
  agentDirRoot: string;
}

export interface ResolvedAgentStorageRoots extends AgentStorageSettings {
  hostDataRoot: string;
  workspaceRootAbsolute: string;
  agentDirRootAbsolute: string;
}

const DEFAULT_AGENT_STORAGE: AgentStorageSettings = {
  workspaceRoot: "openclaw/workspace/agents",
  agentDirRoot: "openclaw/agents",
};

export function sanitizeAgentStorageRelativePath(
  value: string,
  fallback: string,
) {
  const normalized = value.trim().replace(/\\/g, "/");
  const trimmed = normalized.replace(/^\/+|\/+$/g, "");
  if (!trimmed) {
    return fallback;
  }
  if (path.isAbsolute(normalized) || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error("Agent 数据目录不能使用绝对路径");
  }
  if (trimmed === "." || trimmed.startsWith("..") || trimmed.includes("/../")) {
    throw new Error(
      "Agent 数据目录只支持 OPENCLAW_HOST_DATA_ROOT 下的相对路径",
    );
  }
  return trimmed;
}

export function getDefaultAgentStorageSettings() {
  return { ...DEFAULT_AGENT_STORAGE };
}

export async function readAgentStorageSettings(): Promise<AgentStorageSettings> {
  const settings = await readAdminSettings();
  const agentStorage = settings.platform?.agentStorage;
  return {
    workspaceRoot: sanitizeAgentStorageRelativePath(
      agentStorage?.workspaceRoot || "",
      DEFAULT_AGENT_STORAGE.workspaceRoot,
    ),
    agentDirRoot: sanitizeAgentStorageRelativePath(
      agentStorage?.agentDirRoot || "",
      DEFAULT_AGENT_STORAGE.agentDirRoot,
    ),
  };
}

export async function writeAgentStorageSettings(input: AgentStorageSettings) {
  const current = await readAdminSettings();
  const nextSettings: AgentStorageSettings = {
    workspaceRoot: sanitizeAgentStorageRelativePath(
      input.workspaceRoot,
      DEFAULT_AGENT_STORAGE.workspaceRoot,
    ),
    agentDirRoot: sanitizeAgentStorageRelativePath(
      input.agentDirRoot,
      DEFAULT_AGENT_STORAGE.agentDirRoot,
    ),
  };

  await writeAdminSettings({
    ...current,
    platform: {
      ...(current.platform ?? {}),
      agentStorage: nextSettings,
    },
  });

  const { hostDataRoot } = getAdminPaths();
  await fs.mkdir(path.join(hostDataRoot, nextSettings.workspaceRoot), {
    recursive: true,
  });
  await fs.mkdir(path.join(hostDataRoot, nextSettings.agentDirRoot), {
    recursive: true,
  });

  return nextSettings;
}

export async function resolveAgentStorageRoots(): Promise<ResolvedAgentStorageRoots> {
  const { hostDataRoot } = getAdminPaths();
  const settings = await readAgentStorageSettings();
  return {
    ...settings,
    hostDataRoot,
    workspaceRootAbsolute: path.join(hostDataRoot, settings.workspaceRoot),
    agentDirRootAbsolute: path.join(hostDataRoot, settings.agentDirRoot),
  };
}

export async function resolveAgentStoragePaths(agentId: string) {
  const roots = await resolveAgentStorageRoots();
  return {
    workspacePath: path.join(roots.workspaceRootAbsolute, agentId),
    agentDirPath: path.join(roots.agentDirRootAbsolute, agentId, "agent"),
  };
}

export function buildAgentPathsFromRoots(input: {
  agentId: string;
  workspaceRoot: string;
  agentDirRoot: string;
}) {
  return {
    workspacePath: path.join(input.workspaceRoot, input.agentId),
    agentDirPath: path.join(input.agentDirRoot, input.agentId, "agent"),
  };
}

export function isPathWithinHostDataRoot(
  hostDataRoot: string,
  targetPath: string,
) {
  const relative = path.relative(hostDataRoot, targetPath);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

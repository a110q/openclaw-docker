import fs from "fs/promises";
import path from "path";
import { getAdminPaths } from "./paths";
import { writeJsonFile, readJsonFile } from "./json-store";
import { createTask, updateTask } from "./tasks";
import { listAgents, saveAgent } from "./agents";
import { resolveAgentStorageRoots } from "./agent-storage";
import type { DiscoveryItem } from "@/lib/types/admin";

function buildDiscoveryItem(
  agentId: string,
  dirPath: string,
  managedIds: Set<string>,
): DiscoveryItem {
  return {
    path: dirPath,
    suggestedName: agentId,
    status: managedIds.has(agentId) ? "already-managed" : "discoverable",
    reason: managedIds.has(agentId)
      ? "Agent 已存在于当前配置"
      : "检测到标准 Agent 目录",
    lastModifiedAt: undefined,
  };
}

export async function scanForAgents() {
  const { discoveryResultsDir } = getAdminPaths();
  const roots = await resolveAgentStorageRoots();
  const agentsRoot = roots.agentDirRootAbsolute;
  const entries = await fs
    .readdir(agentsRoot, { withFileTypes: true })
    .catch(() => []);
  const agents = await listAgents();
  const managedIds = new Set(agents.map((item) => item.id));

  const items = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      buildDiscoveryItem(
        entry.name,
        path.join(agentsRoot, entry.name),
        managedIds,
      ),
    );

  const task = await createTask({
    type: "agent_discovery_scan",
    title: "扫描已有 Agent",
    targetType: "agent",
  });
  await updateTask(task.id, {
    status: "succeeded",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    progress: 100,
    summary: `扫描到 ${items.length} 个目录`,
  });
  await writeJsonFile(path.join(discoveryResultsDir, `${task.id}.json`), items);
  return { taskId: task.id, items };
}

export async function readDiscoveryResults(taskId: string) {
  const { discoveryResultsDir } = getAdminPaths();
  return readJsonFile<DiscoveryItem[]>(
    path.join(discoveryResultsDir, `${taskId}.json`),
    [],
  );
}

export async function importDiscoveryItems(
  items: Array<{ path: string; suggestedName: string }>,
) {
  const created = [];
  for (const item of items) {
    created.push(
      await saveAgent({
        id: item.suggestedName,
        name: item.suggestedName,
        primaryModelId: "",
        source: "discovered",
        notes: `导入自 ${item.path}`,
        tags: ["discovered"],
      }),
    );
  }
  return created;
}

import fs from "fs/promises";
import path from "path";
import { readOpenClawConfig, writeOpenClawConfig } from "./config-files";
import { runCommand } from "./compose";
import { logActivity } from "./activity";
import { readJsonFile, writeJsonFile } from "./json-store";
import { getAdminPaths } from "./paths";
import { listAgents, readManagedAgents } from "./agents";
import {
  readAgentStorageSettings,
  resolveAgentStoragePaths,
  resolveAgentStorageRoots,
} from "./agent-storage";
import type { ManagedAgent, MigrationExportSummary } from "@/lib/types/admin";

interface OpenClawBindingEntry {
  agentId?: string;
  match?: {
    channel?: string;
    peer?: { kind?: string; id?: string };
  };
}

interface OpenClawConfigMigrationShape {
  agents?: {
    list?: Array<{
      id: string;
      default?: boolean;
      name?: string;
      workspace?: string;
      agentDir?: string;
      model?: { primary?: string };
      imageModel?: { primary?: string };
    }>;
    defaults?: Record<string, unknown>;
  };
  channels?: {
    feishu?: {
      groups?: Record<string, unknown>;
      allowFrom?: string[];
      dmAllowFrom?: string[];
      groupAllowFrom?: string[];
    };
  };
  bindings?: OpenClawBindingEntry[];
}

interface AgentExportManifest {
  kind: "agent-bundle";
  version: 1;
  exportedAt: string;
  sourceHostDataRoot: string;
  agentIds: string[];
  agentStorage: {
    workspaceRoot: string;
    agentDirRoot: string;
  };
}

interface PlatformExportManifest {
  kind: "platform-bundle";
  version: 1;
  exportedAt: string;
  sourceHostDataRoot: string;
  agentStorage: {
    workspaceRoot: string;
    agentDirRoot: string;
  };
  includedPaths: string[];
}

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureSafeFileName(fileName: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    throw new Error("非法文件名");
  }
  return fileName;
}

function uniqueList(values: string[] = []) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function inferBundleKind(fileName: string): MigrationExportSummary["kind"] {
  if (fileName.startsWith("openclaw-agents-")) {
    return "agent-bundle";
  }
  if (fileName.startsWith("openclaw-platform-")) {
    return "platform-bundle";
  }
  return "unknown";
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function removeDir(dirPath: string) {
  await fs.rm(dirPath, { recursive: true, force: true }).catch(() => undefined);
}

async function copyDirIfExists(sourcePath: string, targetPath: string) {
  const stat = await fs.stat(sourcePath).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    return false;
  }
  await ensureDir(path.dirname(targetPath));
  await fs.cp(sourcePath, targetPath, { recursive: true, force: true });
  return true;
}

async function copyFileIfExists(sourcePath: string, targetPath: string) {
  const stat = await fs.stat(sourcePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    return false;
  }
  await ensureDir(path.dirname(targetPath));
  await fs.copyFile(sourcePath, targetPath);
  return true;
}

function isFeishuGroupBinding(entry: OpenClawBindingEntry) {
  return (
    entry.match?.channel === "feishu" &&
    entry.match?.peer?.kind === "group" &&
    Boolean(entry.match.peer.id)
  );
}

function isFeishuDmBinding(entry: OpenClawBindingEntry) {
  const kind = String(entry.match?.peer?.kind || "").trim().toLowerCase();
  return (
    entry.match?.channel === "feishu" &&
    ["direct", "dm", "p2p"].includes(kind) &&
    Boolean(entry.match?.peer?.id)
  );
}

function collectFeishuGroupIds(bindings: OpenClawBindingEntry[]) {
  return Array.from(
    new Set(
      bindings
        .filter((entry) => isFeishuGroupBinding(entry))
        .map((entry) => entry.match?.peer?.id as string),
    ),
  );
}

function collectFeishuDmPeerIds(bindings: OpenClawBindingEntry[]) {
  return Array.from(
    new Set(
      bindings
        .filter((entry) => isFeishuDmBinding(entry))
        .map((entry) => entry.match?.peer?.id as string),
    ),
  );
}

async function createArchive(stagingDir: string, outputFile: string) {
  await ensureDir(path.dirname(outputFile));
  const result = await runCommand([
    "tar",
    "-czf",
    outputFile,
    "-C",
    stagingDir,
    ".",
  ]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "生成迁移包失败");
  }
}

async function extractArchive(archiveFile: string, targetDir: string) {
  await ensureDir(targetDir);
  const result = await runCommand([
    "tar",
    "-xzf",
    archiveFile,
    "-C",
    targetDir,
  ]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || "解压迁移包失败");
  }
}

function buildBundleReadme(kind: "agent-bundle" | "platform-bundle") {
  if (kind === "platform-bundle") {
    return [
      "# OpenClaw 平台迁移包",
      "",
      "1. 在目标环境解压此压缩包。",
      "2. 运行 `./bootstrap-migrate.sh <目标 OPENCLAW_HOST_DATA_ROOT>`。",
      "3. 脚本会重写宿主机绝对路径并执行 `docker compose up -d --build`。",
      "",
      "说明：",
      "- 迁移包包含当前部署骨架、.env、openclaw 配置、Admin UI 元数据，以及 Agent 所需宿主机目录。",
      "- 既有 Agent 的绝对路径会在迁移脚本里自动改写到目标宿主机根目录。",
      "- 目标环境需已安装 Docker / Docker Compose / python3。",
      "",
    ].join("\n");
  }

  return [
    "# OpenClaw Agent 导入包",
    "",
    "可通过 Admin UI 的 Agent 导入功能上传此压缩包。",
    "导入时会同步 Agent 配置、绑定关系、飞书群配置，以及 workspace / agent 目录内容。",
    "",
  ].join("\n");
}

function buildBootstrapScript(sourceHostDataRoot: string) {
  return `#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "\${BASH_SOURCE[0]}")" && pwd)"
TARGET_ROOT="\${1:-\${OPENCLAW_HOST_DATA_ROOT:-}}"

if [ -z "$TARGET_ROOT" ]; then
  echo "Usage: ./bootstrap-migrate.sh <target-openclaw-host-root>" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2
  exit 1
fi

python3 - "$SCRIPT_DIR" "$TARGET_ROOT" <<'PY'
from pathlib import Path
import sys

script_dir = Path(sys.argv[1])
target_root = sys.argv[2]
source_root = ${JSON.stringify(sourceHostDataRoot)}
files = [
    script_dir / "host-data/openclaw/openclaw.json",
    script_dir / "host-data/openclaw/admin-ui/managed-agents.json",
    script_dir / "host-data/openclaw/admin-ui/settings.json",
    script_dir / "deployment/.env",
]
for file_path in files:
    if not file_path.exists():
        continue
    text = file_path.read_text(encoding="utf-8")
    if source_root in text:
        file_path.write_text(text.replace(source_root, target_root), encoding="utf-8")
PY

python3 - "$SCRIPT_DIR" "$TARGET_ROOT" <<'PY'
from pathlib import Path
import sys

env_path = Path(sys.argv[1]) / "deployment/.env"
target_root = sys.argv[2]
if env_path.exists():
    lines = []
    replaced = False
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("OPENCLAW_HOST_DATA_ROOT="):
            lines.append(f"OPENCLAW_HOST_DATA_ROOT={target_root}")
            replaced = True
        else:
            lines.append(line)
    if not replaced:
        lines.append(f"OPENCLAW_HOST_DATA_ROOT={target_root}")
    env_path.write_text("\\n".join(lines) + "\\n", encoding="utf-8")
PY

mkdir -p "$TARGET_ROOT"
cp -R "$SCRIPT_DIR/host-data/." "$TARGET_ROOT/"

cd "$SCRIPT_DIR/deployment"
docker compose up -d --build
`;
}

function filterDeploymentCopy(sourcePath: string) {
  const name = path.basename(sourcePath);
  return ![
    "node_modules",
    ".next",
    ".git",
    ".playwright-cli",
    "coverage",
  ].includes(name);
}

async function copyDeploymentSkeleton(targetDir: string) {
  const { repoRoot, envFile } = getAdminPaths();
  const entries = [
    "docker-compose.yml",
    "Dockerfile",
    "README.md",
    ".env.example",
    "config",
    "scripts",
    "apps",
    "plugins",
    "overlays",
    "docs",
  ];

  for (const entry of entries) {
    const sourcePath = path.join(repoRoot, entry);
    const stat = await fs.stat(sourcePath).catch(() => null);
    if (!stat) {
      continue;
    }

    const targetPath = path.join(targetDir, entry);
    if (stat.isDirectory()) {
      await fs.cp(sourcePath, targetPath, {
        recursive: true,
        force: true,
        filter: filterDeploymentCopy,
      });
    } else {
      await ensureDir(path.dirname(targetPath));
      await fs.copyFile(sourcePath, targetPath);
    }
  }

  await copyFileIfExists(envFile, path.join(targetDir, ".env"));
}

function getRelativeHostPath(hostDataRoot: string, absolutePath: string) {
  const relative = path.relative(hostDataRoot, absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`路径不在 OPENCLAW_HOST_DATA_ROOT 内：${absolutePath}`);
  }
  return relative.replace(/\\/g, "/");
}

async function copyRelativeHostSubtree(
  hostDataRoot: string,
  relativePath: string,
  targetRoot: string,
) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return;
  }
  await copyDirIfExists(
    path.join(hostDataRoot, normalized),
    path.join(targetRoot, normalized),
  );
}

export async function listMigrationExports() {
  const { migrationExportsDir } = getAdminPaths();
  await ensureDir(migrationExportsDir);
  const entries = await fs
    .readdir(migrationExportsDir, { withFileTypes: true })
    .catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort()
    .reverse();
}

export async function listMigrationExportSummaries(
  limit = 12,
): Promise<MigrationExportSummary[]> {
  const { migrationExportsDir } = getAdminPaths();
  await ensureDir(migrationExportsDir);
  const entries = await fs
    .readdir(migrationExportsDir, { withFileTypes: true })
    .catch(() => []);

  const summaries = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const filePath = path.join(migrationExportsDir, entry.name);
        const stat = await fs.stat(filePath);
        return {
          fileName: entry.name,
          kind: inferBundleKind(entry.name),
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          downloadPath: `/api/admin/v1/migration/download/${encodeURIComponent(entry.name)}`,
        } satisfies MigrationExportSummary;
      }),
  );

  return summaries
    .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))
    .slice(0, limit);
}

export async function exportAgentsBundle(agentIds: string[]) {
  const paths = getAdminPaths();
  const storage = await readAgentStorageSettings();
  const [config, managedAgents, listedAgents] = await Promise.all([
    readOpenClawConfig<OpenClawConfigMigrationShape>(),
    readManagedAgents(),
    listAgents(),
  ]);

  const requestedIds = Array.from(new Set(agentIds.map((item) => item.trim()).filter(Boolean)));
  const selectedAgents = listedAgents.filter((agent) => requestedIds.includes(agent.id));
  if (!selectedAgents.length) {
    throw new Error("没有可导出的 Agent");
  }

  const selectedIds = selectedAgents.map((agent) => agent.id);
  const feishu = config.channels?.feishu ?? {};
  const selectedConfigAgents = (config.agents?.list ?? []).filter((item) =>
    selectedIds.includes(item.id),
  );
  const selectedBindings = (config.bindings ?? []).filter(
    (item) => item.agentId && selectedIds.includes(item.agentId),
  );
  const groupIds = collectFeishuGroupIds(selectedBindings);
  const dmPeerIds = collectFeishuDmPeerIds(selectedBindings);
  const selectedGroups = Object.fromEntries(
    Object.entries(feishu.groups ?? {}).filter(([groupId]) => groupIds.includes(groupId)),
  );
  const selectedMeta = managedAgents.filter((agent) => selectedIds.includes(agent.id));

  const exportName = `openclaw-agents-${timestampSlug()}.tar.gz`;
  const outputFile = path.join(paths.migrationExportsDir, exportName);
  const stagingDir = path.join(paths.migrationTempDir, `agent-export-${timestampSlug()}`);
  const payloadDir = path.join(stagingDir, "payload");

  await removeDir(stagingDir);
  await ensureDir(path.join(payloadDir, "data", "agents"));

  const manifest: AgentExportManifest = {
    kind: "agent-bundle",
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceHostDataRoot: paths.hostDataRoot,
    agentIds: selectedIds,
    agentStorage: storage,
  };

  await writeJsonFile(path.join(stagingDir, "manifest.json"), manifest);
  await fs.writeFile(path.join(stagingDir, "README.txt"), buildBundleReadme("agent-bundle"), "utf8");
  await writeJsonFile(path.join(payloadDir, "openclaw-fragment.json"), {
    agents: { list: selectedConfigAgents },
    bindings: selectedBindings,
    channels: {
      feishu: {
        groups: selectedGroups,
        allowFrom: uniqueList((feishu.allowFrom ?? []).filter((peerId) => dmPeerIds.includes(peerId))),
        dmAllowFrom: uniqueList((feishu.dmAllowFrom ?? []).filter((peerId) => dmPeerIds.includes(peerId))),
        groupAllowFrom: uniqueList(
          (feishu.groupAllowFrom ?? []).filter((peerId) => groupIds.includes(peerId)),
        ),
      },
    },
  });
  await writeJsonFile(path.join(payloadDir, "managed-agents.json"), selectedMeta);

  for (const agent of selectedAgents) {
    const agentRoot = path.join(payloadDir, "data", "agents", agent.id);
    await copyDirIfExists(agent.workspacePath, path.join(agentRoot, "workspace"));
    await copyDirIfExists(agent.agentDirPath, path.join(agentRoot, "agent"));
  }

  await createArchive(stagingDir, outputFile);
  await removeDir(stagingDir);
  await logActivity({
    action: "agent.export",
    targetType: "agent",
    targetId: selectedIds.join(","),
    status: "succeeded",
    summary: `导出 ${selectedIds.length} 个 Agent`,
  });

  return {
    fileName: exportName,
    filePath: outputFile,
    downloadPath: `/api/admin/v1/migration/download/${encodeURIComponent(exportName)}`,
    agentCount: selectedIds.length,
  };
}

export async function importAgentsBundle(bundlePath: string) {
  const paths = getAdminPaths();
  const extractDir = path.join(paths.migrationTempDir, `agent-import-${timestampSlug()}`);
  await removeDir(extractDir);
  await extractArchive(bundlePath, extractDir);

  try {
    const manifest = await readJsonFile<AgentExportManifest | null>(
      path.join(extractDir, "manifest.json"),
      null,
    );
    if (!manifest || manifest.kind !== "agent-bundle") {
      throw new Error("不是有效的 Agent 导入包");
    }

    const fragment = await readJsonFile<OpenClawConfigMigrationShape>(
      path.join(extractDir, "payload", "openclaw-fragment.json"),
      {},
    );
    const importedMeta = await readJsonFile<ManagedAgent[]>(
      path.join(extractDir, "payload", "managed-agents.json"),
      [],
    );
    const importedIds = Array.from(
      new Set([...manifest.agentIds, ...importedMeta.map((item) => item.id)].map((item) => item.trim()).filter(Boolean)),
    );
    const config = await readOpenClawConfig<OpenClawConfigMigrationShape>();
    config.agents ??= {};
    config.agents.list ??= [];

    const rewrittenConfigAgents: NonNullable<
      NonNullable<OpenClawConfigMigrationShape["agents"]>["list"]
    > = [];
    for (const item of fragment.agents?.list ?? []) {
      const nextPaths = await resolveAgentStoragePaths(item.id);
      rewrittenConfigAgents.push({
        ...item,
        workspace: nextPaths.workspacePath,
        agentDir: nextPaths.agentDirPath,
      });
    }

    config.agents.list = config.agents.list.filter((item) => !importedIds.includes(item.id));
    config.agents.list.push(...rewrittenConfigAgents);

    const currentBindings = (config.bindings ?? []).filter(
      (item) => !item.agentId || !importedIds.includes(item.agentId),
    );
    config.bindings = [...currentBindings, ...(fragment.bindings ?? [])];

    config.channels ??= {};
    config.channels.feishu ??= {};
    if (fragment.channels?.feishu?.groups) {
      config.channels.feishu.groups = {
        ...(config.channels.feishu.groups ?? {}),
        ...fragment.channels.feishu.groups,
      };
    }
    if (fragment.channels?.feishu?.allowFrom?.length) {
      config.channels.feishu.allowFrom = uniqueList([
        ...(config.channels.feishu.allowFrom ?? []),
        ...fragment.channels.feishu.allowFrom,
      ]);
    }
    if (fragment.channels?.feishu?.dmAllowFrom?.length) {
      config.channels.feishu.dmAllowFrom = uniqueList([
        ...(config.channels.feishu.dmAllowFrom ?? []),
        ...fragment.channels.feishu.dmAllowFrom,
      ]);
    }
    if (fragment.channels?.feishu?.groupAllowFrom?.length) {
      config.channels.feishu.groupAllowFrom = uniqueList([
        ...(config.channels.feishu.groupAllowFrom ?? []),
        ...fragment.channels.feishu.groupAllowFrom,
      ]);
    }

    await writeOpenClawConfig(config);

    const currentManaged = await readManagedAgents();
    const nextManaged = currentManaged.filter((item) => !importedIds.includes(item.id));

    for (const item of importedMeta) {
      const nextPaths = await resolveAgentStoragePaths(item.id);
      nextManaged.push({
        ...item,
        workspacePath: nextPaths.workspacePath,
        agentDirPath: nextPaths.agentDirPath,
        managed: true,
      });

      const agentRoot = path.join(extractDir, "payload", "data", "agents", item.id);
      await removeDir(nextPaths.workspacePath);
      await removeDir(nextPaths.agentDirPath);
      await copyDirIfExists(path.join(agentRoot, "workspace"), nextPaths.workspacePath);
      await copyDirIfExists(path.join(agentRoot, "agent"), nextPaths.agentDirPath);
    }

    await writeJsonFile(paths.managedAgentsFile, nextManaged);
    await logActivity({
      action: "agent.import",
      targetType: "agent",
      targetId: importedIds.join(","),
      status: "succeeded",
      summary: `导入 ${importedIds.length} 个 Agent`,
    });

    return { importedAgentIds: importedIds };
  } finally {
    await removeDir(extractDir);
  }
}

export async function exportPlatformBundle() {
  const paths = getAdminPaths();
  const storage = await readAgentStorageSettings();
  const roots = await resolveAgentStorageRoots();
  const exportName = `openclaw-platform-${timestampSlug()}.tar.gz`;
  const outputFile = path.join(paths.migrationExportsDir, exportName);
  const stagingDir = path.join(paths.migrationTempDir, `platform-export-${timestampSlug()}`);
  const deploymentDir = path.join(stagingDir, "deployment");
  const hostDataDir = path.join(stagingDir, "host-data");

  await removeDir(stagingDir);
  await ensureDir(deploymentDir);
  await ensureDir(hostDataDir);

  await copyDeploymentSkeleton(deploymentDir);
  await copyRelativeHostSubtree(paths.hostDataRoot, "openclaw", hostDataDir);

  const includedPaths = ["openclaw"];
  for (const absolutePath of [roots.workspaceRootAbsolute, roots.agentDirRootAbsolute]) {
    const relative = getRelativeHostPath(paths.hostDataRoot, absolutePath);
    if (relative === "openclaw" || relative.startsWith("openclaw/")) {
      continue;
    }
    if (!includedPaths.includes(relative)) {
      includedPaths.push(relative);
      await copyRelativeHostSubtree(paths.hostDataRoot, relative, hostDataDir);
    }
  }

  const manifest: PlatformExportManifest = {
    kind: "platform-bundle",
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceHostDataRoot: paths.hostDataRoot,
    agentStorage: storage,
    includedPaths,
  };

  await writeJsonFile(path.join(stagingDir, "manifest.json"), manifest);
  await fs.writeFile(path.join(stagingDir, "README.txt"), buildBundleReadme("platform-bundle"), "utf8");
  await fs.writeFile(path.join(stagingDir, "bootstrap-migrate.sh"), buildBootstrapScript(paths.hostDataRoot), {
    encoding: "utf8",
    mode: 0o755,
  });

  await createArchive(stagingDir, outputFile);
  await removeDir(stagingDir);
  await logActivity({
    action: "platform.export",
    targetType: "config",
    targetId: "migration-bundle",
    status: "succeeded",
    summary: "生成平台迁移包",
  });

  return {
    fileName: exportName,
    filePath: outputFile,
    downloadPath: `/api/admin/v1/migration/download/${encodeURIComponent(exportName)}`,
  };
}

export function resolveMigrationExportFile(fileName: string) {
  const { migrationExportsDir } = getAdminPaths();
  return path.join(migrationExportsDir, ensureSafeFileName(fileName));
}

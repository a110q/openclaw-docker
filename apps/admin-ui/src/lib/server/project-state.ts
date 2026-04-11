import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getAdminPaths } from './paths';
import { writeJsonFile, readJsonFile } from './json-store';
import { listAgents } from './agents';
import { listProviders, listModels } from './providers';
import { readSystemStatus } from './system-status';
import { readNetworkPolicyStatus } from './network-policy';
import { readOpenClawConfigDiagnostics } from './config-diagnostics';
import { listAlertChannels } from './alerts';
import { listTasks } from './tasks';
import { listActivity } from './activity';

const execFileAsync = promisify(execFile);
const SNAPSHOT_TTL_MS = 20_000;
const CONFIG_CHANGE_ACTIONS = new Map<string, 'restart' | 'force-recreate'>([
  ['provider.save', 'force-recreate'],
  ['model.default.save', 'force-recreate'],
  ['agent.save', 'force-recreate'],
  ['agent.bindings.save', 'force-recreate'],
  ['feishu.binding.save', 'force-recreate'],
  ['feishu.binding.delete', 'force-recreate'],
  ['config.autofix', 'force-recreate'],
  ['alert.channel.save', 'restart'],
  ['alert.channel.delete', 'restart'],
  ['alert.rules.save', 'restart']
]);
const RELOAD_ACTIONS = new Set(['gateway.start', 'gateway.restart', 'gateway.recreate']);

interface SnapshotInput {
  currentPath: string;
  title: string;
  description?: string;
  badge?: string;
  sectionLabel?: string;
}

interface RuntimeSnapshot {
  updatedAt: string;
  currentView: SnapshotInput;
  runtime: {
    deploymentMode: string;
    gateway: {
      status: string;
      health: string;
      containerName?: string;
      ports: string[];
      image?: string;
    };
    adminUi: {
      status: string;
      version: string;
    };
    network: {
      decision: string;
      decisionLabel: string;
      modeLabel: string;
      effectiveProxy?: string;
      configuredProxy?: string;
      sandboxUsesProxy: boolean;
      sandboxExtraHostCount: number;
      lastCheckedAt?: string;
      reason: string;
      probeError?: string;
    };
    diagnostics: {
      summary: string;
      issueCount: number;
      autoFixableCount: number;
      checkedAt: string;
    };
    alerts: {
      totalChannels: number;
      enabledChannels: number;
    };
  };
  models: {
    defaultModelId?: string;
    defaultProviderId?: string;
    providerCount: number;
    modelCount: number;
    providers: Array<{
      id: string;
      name: string;
      type: string;
      enabled: boolean;
      isDefault: boolean;
      defaultModelId?: string;
      modelIds: string[];
      lastTestStatus: string;
    }>;
  };
  agents: {
    total: number;
    running: number;
    discovered: number;
    manual: number;
    batchCreated: number;
    bindings: Array<{
      id: string;
      name: string;
      runtimeStatus: string;
      source: string;
      primaryModelId: string;
      imageModelId?: string;
      inheritsDefaultModel: boolean;
      workspacePath: string;
      agentDirPath: string;
    }>;
  };
  reload: {
    pending: boolean;
    latestConfigChange?: {
      action: string;
      createdAt: string;
      summary?: string;
      impact: 'restart' | 'force-recreate';
    };
    latestReload?: {
      action: string;
      createdAt: string;
      summary?: string;
    };
    recommendedCommand: string;
    fallbackCommand: string;
    reason: string;
    recentConfigActions: Array<{
      action: string;
      createdAt: string;
      summary?: string;
      impact: 'restart' | 'force-recreate';
    }>;
  };
  tasks: {
    pending: number;
    running: number;
    latest: Array<{
      title: string;
      status: string;
      createdAt: string;
      summary?: string;
    }>;
  };
  activity: {
    latest: Array<{
      action: string;
      targetId?: string;
      createdAt: string;
      summary?: string;
      status: string;
    }>;
  };
  workspace: {
    gitStatusAvailable: boolean;
    dirtyCount: number;
    modifiedFiles: string[];
  };
  notes: string[];
}

function formatDateTime(value?: string) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

function relativeToRepo(repoRoot: string, targetPath: string) {
  if (!targetPath) return '';
  if (!targetPath.startsWith(repoRoot)) return targetPath;
  return path.relative(repoRoot, targetPath) || '.';
}

async function readGitStatus(repoRoot: string) {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--short'], { cwd: repoRoot, maxBuffer: 1024 * 1024 });
    const lines = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return {
      gitStatusAvailable: true,
      dirtyCount: lines.length,
      modifiedFiles: lines.slice(0, 80)
    };
  } catch {
    return {
      gitStatusAvailable: false,
      dirtyCount: 0,
      modifiedFiles: []
    };
  }
}

function deriveReloadState(activities: Awaited<ReturnType<typeof listActivity>>) {
  const configChanges = activities
    .filter((entry) => CONFIG_CHANGE_ACTIONS.has(entry.action))
    .map((entry) => ({
      action: entry.action,
      createdAt: entry.createdAt,
      summary: entry.summary,
      impact: CONFIG_CHANGE_ACTIONS.get(entry.action) as 'restart' | 'force-recreate'
    }));

  const latestConfigChange = configChanges[0];
  const latestReload = activities
    .filter((entry) => RELOAD_ACTIONS.has(entry.action) && entry.status === 'succeeded')
    .map((entry) => ({ action: entry.action, createdAt: entry.createdAt, summary: entry.summary }))
    [0];

  const pending = Boolean(
    latestConfigChange && (!latestReload || latestConfigChange.createdAt > latestReload.createdAt)
  );

  const impact = latestConfigChange?.impact || 'force-recreate';
  const recommendedCommand = impact === 'restart' ? 'docker compose restart openclaw-gateway' : './scripts/reload-gateway.sh';
  const fallbackCommand = impact === 'restart'
    ? './scripts/reload-gateway.sh'
    : 'docker compose up -d --force-recreate openclaw-gateway';

  let reason = '最近一次配置变更已经被后续的 Gateway 重载覆盖。';
  if (!latestConfigChange) {
    reason = '最近没有发现需要 Gateway 重新载入的配置改动。';
  } else if (pending) {
    reason = latestReload
      ? `最近一次配置改动晚于最近一次 Gateway 重载，建议执行${impact === 'restart' ? '平滑重启' : '强制重建'}。`
      : `检测到配置改动，但还没有记录到后续 Gateway 重载，建议执行${impact === 'restart' ? '平滑重启' : '强制重建'}。`;
  }

  return {
    pending,
    latestConfigChange,
    latestReload,
    recommendedCommand,
    fallbackCommand,
    reason,
    recentConfigActions: configChanges.slice(0, 8)
  };
}

function buildSessionStateMarkdown(snapshot: RuntimeSnapshot, repoRoot: string) {
  const lines: string[] = [];
  lines.push('# Session State');
  lines.push('');
  lines.push(`- 更新时间：${formatDateTime(snapshot.updatedAt)}`);
  lines.push(`- 当前页面：${snapshot.currentView.title} (${snapshot.currentView.currentPath})`);
  lines.push(`- 当前标签：${snapshot.currentView.badge || '无'}`);
  lines.push('');
  lines.push('## 当前运行态');
  lines.push('');
  lines.push(`- Gateway：${snapshot.runtime.gateway.status} / ${snapshot.runtime.gateway.health}`);
  lines.push(`- Admin UI：${snapshot.runtime.adminUi.status} / ${snapshot.runtime.adminUi.version}`);
  lines.push(`- 部署模式：${snapshot.runtime.deploymentMode}`);
  lines.push(`- 默认模型：${snapshot.models.defaultModelId || '未配置'}`);
  lines.push(`- 默认 Provider：${snapshot.models.defaultProviderId || '未配置'}`);
  lines.push(`- 网络决策：${snapshot.runtime.network.decisionLabel}（${snapshot.runtime.network.reason}）`);
  lines.push(`- 飞书通道：${snapshot.runtime.alerts.enabledChannels}/${snapshot.runtime.alerts.totalChannels}`);
  lines.push('');
  lines.push('## Agent 绑定');
  lines.push('');
  if (!snapshot.agents.bindings.length) {
    lines.push('- 当前没有纳管 Agent');
  } else {
    snapshot.agents.bindings.slice(0, 20).forEach((agent) => {
      lines.push(
        `- ${agent.id} · ${agent.primaryModelId || '未绑定'} · ${agent.runtimeStatus} · ${agent.inheritsDefaultModel ? '继承默认' : '显式绑定'} · ${relativeToRepo(repoRoot, agent.workspacePath)}`
      );
    });
  }
  lines.push('');
  lines.push('## 待重载提示');
  lines.push('');
  lines.push(`- 是否待重载：${snapshot.reload.pending ? '是' : '否'}`);
  lines.push(`- 建议命令：\`${snapshot.reload.recommendedCommand}\``);
  lines.push(`- 备用命令：\`${snapshot.reload.fallbackCommand}\``);
  lines.push(`- 原因：${snapshot.reload.reason}`);
  if (snapshot.reload.latestConfigChange) {
    lines.push(
      `- 最近配置改动：${snapshot.reload.latestConfigChange.action} @ ${formatDateTime(snapshot.reload.latestConfigChange.createdAt)}`
    );
  }
  if (snapshot.reload.latestReload) {
    lines.push(`- 最近重载：${snapshot.reload.latestReload.action} @ ${formatDateTime(snapshot.reload.latestReload.createdAt)}`);
  }
  lines.push('');
  lines.push('## 最近活动');
  lines.push('');
  snapshot.activity.latest.slice(0, 8).forEach((item) => {
    lines.push(`- ${formatDateTime(item.createdAt)} · ${item.action} · ${item.summary || item.targetId || '无摘要'}`);
  });
  lines.push('');
  lines.push('## 工作区');
  lines.push('');
  if (snapshot.workspace.gitStatusAvailable) {
    lines.push(`- 脏文件数：${snapshot.workspace.dirtyCount}`);
    snapshot.workspace.modifiedFiles.slice(0, 20).forEach((file) => {
      lines.push(`- ${file}`);
    });
  } else {
    lines.push('- 当前运行环境不可用 `git status`，工作区脏文件列表未采集。');
  }
  lines.push('');
  lines.push('## 持续约定');
  lines.push('');
  snapshot.notes.forEach((note) => lines.push(`- ${note}`));
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export async function syncProjectStateSnapshot(input: SnapshotInput) {
  const { repoRoot } = getAdminPaths();
  const projectStateDir = path.join(repoRoot, 'project_state');
  const runtimeSnapshotFile = path.join(projectStateDir, 'runtime-snapshot.json');
  const sessionStateFile = path.join(projectStateDir, 'SESSION_STATE.md');

  const existing = await readJsonFile<{ updatedAt?: string; currentView?: { currentPath?: string } } | null>(runtimeSnapshotFile, null);
  if (existing?.updatedAt) {
    const age = Date.now() - new Date(existing.updatedAt).getTime();
    if (age < SNAPSHOT_TTL_MS && existing.currentView?.currentPath === input.currentPath) {
      return;
    }
  }

  const [
    agents,
    providers,
    models,
    status,
    networkPolicy,
    diagnostics,
    alertChannels,
    tasks,
    activity,
    workspace
  ] = await Promise.all([
    listAgents(),
    listProviders(),
    listModels(),
    readSystemStatus(),
    readNetworkPolicyStatus(),
    readOpenClawConfigDiagnostics(),
    listAlertChannels(),
    listTasks(),
    listActivity(),
    readGitStatus(repoRoot)
  ]);

  const reload = deriveReloadState(activity);
  const snapshot: RuntimeSnapshot = {
    updatedAt: new Date().toISOString(),
    currentView: input,
    runtime: {
      deploymentMode: status.deploymentMode,
      gateway: {
        status: status.gateway.status,
        health: status.gateway.health,
        containerName: status.gateway.containerName,
        ports: status.gateway.ports,
        image: status.gateway.image
      },
      adminUi: {
        status: status.adminUi.status,
        version: status.adminUi.version
      },
      network: {
        decision: networkPolicy.decision,
        decisionLabel: networkPolicy.decisionLabel,
        modeLabel: networkPolicy.modeLabel,
        effectiveProxy: networkPolicy.effectiveProxy,
        configuredProxy: networkPolicy.configuredProxy,
        sandboxUsesProxy: networkPolicy.sandboxUsesProxy,
        sandboxExtraHostCount: networkPolicy.sandboxExtraHostCount,
        lastCheckedAt: networkPolicy.lastCheckedAt,
        reason: networkPolicy.reason,
        probeError: networkPolicy.probeError
      },
      diagnostics: {
        summary: diagnostics.summary,
        issueCount: diagnostics.issueCount,
        autoFixableCount: diagnostics.autoFixableCount,
        checkedAt: diagnostics.checkedAt
      },
      alerts: {
        totalChannels: alertChannels.length,
        enabledChannels: alertChannels.filter((item) => item.enabled).length
      }
    },
    models: {
      defaultModelId: models.find((item) => item.isDefault)?.id,
      defaultProviderId: providers.find((item) => item.isDefault)?.id,
      providerCount: providers.length,
      modelCount: models.length,
      providers: providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        type: provider.type,
        enabled: provider.enabled,
        isDefault: provider.isDefault,
        defaultModelId: provider.defaultModelId,
        modelIds: provider.models.map((item) => item.id),
        lastTestStatus: provider.lastTestStatus
      }))
    },
    agents: {
      total: agents.length,
      running: agents.filter((item) => item.runtimeStatus === 'running').length,
      discovered: agents.filter((item) => item.source === 'discovered').length,
      manual: agents.filter((item) => item.source === 'manual').length,
      batchCreated: agents.filter((item) => item.source === 'batch-created').length,
      bindings: agents.map((agent) => ({
        id: agent.id,
        name: agent.displayName,
        runtimeStatus: agent.runtimeStatus,
        source: agent.source,
        primaryModelId: agent.primaryModelId,
        imageModelId: agent.imageModelId,
        inheritsDefaultModel: agent.inheritsDefaultModel,
        workspacePath: agent.workspacePath,
        agentDirPath: agent.agentDirPath
      }))
    },
    reload,
    tasks: {
      pending: tasks.filter((item) => item.status === 'pending').length,
      running: tasks.filter((item) => item.status === 'running').length,
      latest: tasks.slice(0, 8).map((item) => ({
        title: item.title,
        status: item.status,
        createdAt: item.createdAt,
        summary: item.summary
      }))
    },
    activity: {
      latest: activity.slice(0, 10).map((item) => ({
        action: item.action,
        targetId: item.targetId,
        createdAt: item.createdAt,
        summary: item.summary,
        status: item.status
      }))
    },
    workspace,
    notes: [
      '平台默认模型修改不会覆盖已有 Agent 的显式绑定。',
      '如果 18789 看起来没变，优先检查 Agent 显式绑定和历史 session cache。',
      '本轮没有切换 OpenClaw 版本，仍保持当前运行版本。'
    ]
  };

  await fs.mkdir(projectStateDir, { recursive: true });
  await Promise.all([
    writeJsonFile(runtimeSnapshotFile, snapshot),
    fs.writeFile(sessionStateFile, buildSessionStateMarkdown(snapshot, repoRoot), 'utf8')
  ]);
}

import fs from 'fs/promises';
import { logActivity } from './activity';
import { getAdminPaths } from './paths';
import { writeOpenClawConfig } from './config-files';
import type { ConfigAutoFixResult, ConfigDiagnosticIssue, ConfigDiagnostics } from '../types/admin';

const ALLOWED_BINDING_KINDS = ['direct', 'group', 'channel', 'dm', 'acp'] as const;
const LEGACY_BINDING_KIND_FIXES: Record<string, (typeof ALLOWED_BINDING_KINDS)[number]> = {
  p2p: 'dm'
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function createIssue(input: Omit<ConfigDiagnosticIssue, 'id'>): ConfigDiagnosticIssue {
  return {
    id: `${input.scope}:${input.path}:${input.currentValue || 'unknown'}`,
    ...input
  };
}

function summarizeIssues(issues: ConfigDiagnosticIssue[], configPath: string, checkedAt: string): ConfigDiagnostics {
  const summary = issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'warning' : 'healthy';

  return {
    summary,
    configPath,
    checkedAt,
    issueCount: issues.length,
    autoFixableCount: issues.filter((issue) => issue.autoFixAvailable).length,
    issues
  };
}

export function analyzeOpenClawConfig(config: unknown, options?: { configPath?: string; checkedAt?: string }): ConfigDiagnostics {
  const configPath = options?.configPath || 'openclaw.json';
  const checkedAt = options?.checkedAt || new Date().toISOString();
  const issues: ConfigDiagnosticIssue[] = [];

  if (!isRecord(config)) {
    issues.push(
      createIssue({
        scope: 'config',
        severity: 'error',
        path: '$',
        message: '配置根对象不是合法的 JSON object，Gateway 无法加载。',
        autoFixAvailable: false
      })
    );
    return summarizeIssues(issues, configPath, checkedAt);
  }

  const bindings = Array.isArray(config.bindings) ? config.bindings : [];

  bindings.forEach((binding, index) => {
    if (!isRecord(binding)) return;
    const match = isRecord(binding.match) ? binding.match : undefined;
    const peer = match && isRecord(match.peer) ? match.peer : undefined;
    const currentKind = typeof peer?.kind === 'string' ? peer.kind.trim() : '';

    if (!currentKind || ALLOWED_BINDING_KINDS.includes(currentKind as (typeof ALLOWED_BINDING_KINDS)[number])) {
      return;
    }

    const suggestedValue = LEGACY_BINDING_KIND_FIXES[currentKind.toLowerCase()];

    issues.push(
      createIssue({
        scope: 'bindings',
        severity: 'error',
        path: `bindings[${index}].match.peer.kind`,
        message: `绑定类型 \"${currentKind}\" 不受当前 Gateway 支持，可能直接导致启动失败。`,
        currentValue: currentKind,
        allowedValues: [...ALLOWED_BINDING_KINDS],
        suggestedValue,
        autoFixAvailable: Boolean(suggestedValue)
      })
    );
  });

  return summarizeIssues(issues, configPath, checkedAt);
}

export function applyRecommendedConfigFixes(config: unknown) {
  const nextConfig = JSON.parse(JSON.stringify(config ?? null)) as unknown;
  if (!isRecord(nextConfig) || !Array.isArray(nextConfig.bindings)) {
    return { config: nextConfig, fixedCount: 0, fixedPaths: [] as string[] };
  }

  const fixedPaths: string[] = [];

  nextConfig.bindings.forEach((binding, index) => {
    if (!isRecord(binding)) return;
    const match = isRecord(binding.match) ? binding.match : undefined;
    const peer = match && isRecord(match.peer) ? match.peer : undefined;
    const currentKind = typeof peer?.kind === 'string' ? peer.kind.trim() : '';
    const suggestedValue = currentKind ? LEGACY_BINDING_KIND_FIXES[currentKind.toLowerCase()] : undefined;

    if (!peer || !suggestedValue) return;

    peer.kind = suggestedValue;
    fixedPaths.push(`bindings[${index}].match.peer.kind`);
  });

  return {
    config: nextConfig,
    fixedCount: fixedPaths.length,
    fixedPaths
  };
}

export async function readOpenClawConfigDiagnostics(): Promise<ConfigDiagnostics> {
  const { openclawConfigFile } = getAdminPaths();
  const checkedAt = new Date().toISOString();

  try {
    const text = await fs.readFile(openclawConfigFile, 'utf8');
    const config = JSON.parse(text) as unknown;
    return analyzeOpenClawConfig(config, { configPath: openclawConfigFile, checkedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return summarizeIssues(
      [
        createIssue({
          scope: 'config',
          severity: 'error',
          path: openclawConfigFile,
          message: `读取或解析 openclaw.json 失败：${message}`,
          autoFixAvailable: false
        })
      ],
      openclawConfigFile,
      checkedAt
    );
  }
}

export async function applyRecommendedOpenClawConfigFixes(): Promise<ConfigAutoFixResult> {
  const { openclawConfigFile } = getAdminPaths();
  const original = await fs.readFile(openclawConfigFile, 'utf8');
  const parsed = JSON.parse(original) as unknown;
  const result = applyRecommendedConfigFixes(parsed);

  if (result.fixedCount === 0) {
    return {
      fixedCount: 0,
      fixedPaths: [],
      restartRecommended: false,
      summary: '当前没有可自动修复的推荐项。'
    };
  }

  const backupSuffix = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = `${openclawConfigFile}.admin-ui-fix-${backupSuffix}.bak`;
  await fs.writeFile(backupFile, original, 'utf8');
  await writeOpenClawConfig(result.config);

  await logActivity({
    action: 'config.autofix',
    targetType: 'config',
    targetId: 'openclaw.json',
    status: 'logged',
    summary: `自动修复 ${result.fixedCount} 项 openclaw.json 配置问题`
  });

  return {
    fixedCount: result.fixedCount,
    fixedPaths: result.fixedPaths,
    backupFile,
    restartRecommended: true,
    summary: `已自动修复 ${result.fixedCount} 项配置问题，建议立即重启 Gateway。`
  };
}

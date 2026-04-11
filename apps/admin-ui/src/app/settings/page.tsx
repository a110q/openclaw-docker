import { AppShell } from '@/components/layout/app-shell';
import { StatusCard } from '@/components/cards/status-card';
import { AgentStoragePanel } from '@/components/settings/agent-storage-panel';
import { PlatformMigrationPanel } from '@/components/settings/platform-migration-panel';
import { SandboxResourcePolicyPanel } from '@/components/settings/sandbox-resource-policy-panel';
import { getAdminEnv } from '@/lib/server/env';
import { readAgentStorageSettings, resolveAgentStorageRoots } from '@/lib/server/agent-storage';
import { listMigrationExportSummaries } from '@/lib/server/migration';
import { getAdminPaths } from '@/lib/server/paths';
import { readSandboxResourcePolicy } from '@/lib/server/sandbox-resources';

export const dynamic = 'force-dynamic';

function formatSandboxPolicy(policy: {
  cpus?: number;
  memory?: string;
  memorySwap?: string;
  pidsLimit?: number;
}) {
  return [
    policy.cpus != null ? `CPU ${policy.cpus}` : 'CPU 未限制',
    policy.memory ? `内存 ${policy.memory}` : '内存 未限制',
    policy.memorySwap ? `Swap ${policy.memorySwap}` : 'Swap 未限制',
    policy.pidsLimit != null ? `PIDs ${policy.pidsLimit}` : 'PIDs 未限制',
  ].join(' · ');
}

export default async function SettingsPage() {
  const env = getAdminEnv();
  const paths = getAdminPaths();
  const [agentStorage, resolvedStorage, migrationExports, sandboxPolicy] = await Promise.all([
    readAgentStorageSettings(),
    resolveAgentStorageRoots(),
    listMigrationExportSummaries(),
    readSandboxResourcePolicy(),
  ]);

  return (
    <AppShell
      currentPath="/settings"
      title="系统设置"
      description="把运行路径、资源边界、Agent 数据目录和平台迁移工具集中到一页，排障和迁移都不需要再回头翻 compose。"
      badge="Runtime Settings"
    >
      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="console-hero">
          <div className="page-eyebrow">Runtime Settings</div>
          <h2 className="mt-3 text-[1.95rem] font-semibold leading-tight tracking-tight text-slate-900 md:text-[2.22rem]">
            把部署摘要保留在上半区，把真正需要常改的运维能力压进下半区。
          </h2>
          <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600">
            大部分部署层参数仍然保持摘要视图，避免误改；但 Agent 数据目录、沙箱默认资源上限、迁移包导出这类高频运维动作，现在支持直接在后台完成，而且页面结构更像控制台，而不是信息堆叠页。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">后台端口 {env.OPENCLAW_ADMIN_UI_PORT}</span>
            <span className="pill-badge">迁移包 {migrationExports.length}</span>
            <span className="pill-badge">鉴权 单管理员令牌</span>
          </div>
        </div>

        <div className="surface-panel p-5 md:p-6">
          <div className="page-eyebrow">Summary</div>
          <div className="mt-4 space-y-3">
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">当前 Agent 存储策略</div>
              <div className="mt-2 text-[1.05rem] font-semibold tracking-tight text-slate-900">相对宿主根目录</div>
              <div className="mt-2 break-all text-[12px] leading-6 text-slate-600">{agentStorage.workspaceRoot} · {agentStorage.agentDirRoot}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">默认沙箱资源</div>
              <div className="mt-2 text-[1.05rem] font-semibold tracking-tight text-slate-900">已接管</div>
              <div className="mt-2 break-all text-[12px] leading-6 text-slate-600">{formatSandboxPolicy(sandboxPolicy)}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">Workspace 根目录</div>
              <div className="mt-2 break-all text-[13px] font-medium leading-6 text-slate-800">{resolvedStorage.workspaceRootAbsolute}</div>
            </div>
            <div className="console-note">设置页更适合做“结构性变更”：目录规划、默认资源边界、迁移包、关键路径确认。改完运行配置后，仍建议去服务控制页确认是否需要重载 Gateway。</div>
          </div>
        </div>
      </section>

      <section className="console-stat-grid">
        <StatusCard title="Repo Root" value="已配置" hint={paths.repoRoot} tone="good" />
        <StatusCard title="Host Data" value="已配置" hint={paths.hostDataRoot} tone="good" />
        <StatusCard title="默认沙箱策略" value={sandboxPolicy.memory || sandboxPolicy.cpus ? '已限制' : '未限制'} hint={formatSandboxPolicy(sandboxPolicy)} tone={sandboxPolicy.memory || sandboxPolicy.cpus || sandboxPolicy.pidsLimit ? 'good' : 'warn'} />
        <StatusCard title="迁移包" value={String(migrationExports.length)} hint="最近导出的 Agent / 平台迁移包" tone={migrationExports.length ? 'good' : 'default'} />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.05fr)_420px] 2xl:items-start">
        <div className="surface-panel p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">关键路径</h2>
            <span className="pill-badge">Paths</span>
          </div>
          <div className="mt-4 space-y-3">
            {[
              ['仓库根目录', paths.repoRoot],
              ['宿主机数据根目录', paths.hostDataRoot],
              ['Admin 数据目录', paths.adminDataDir],
              ['当前 Workspace 根目录', resolvedStorage.workspaceRootAbsolute],
              ['当前 Agent Dir 根目录', resolvedStorage.agentDirRootAbsolute],
              ['`.env`', paths.envFile],
              ['`docker-compose.yml`', paths.composeFile],
              ['`openclaw.json`', paths.openclawConfigFile],
            ].map(([label, value]) => (
              <div key={label} className="list-row">
                <div className="text-[13px] font-medium text-slate-500">{label}</div>
                <div className="mt-2 break-all text-sm font-medium leading-6 text-slate-800">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 2xl:sticky 2xl:top-4">
          <SandboxResourcePolicyPanel initialPolicy={sandboxPolicy} />
          <AgentStoragePanel initialSettings={agentStorage} initialResolved={resolvedStorage} />
          <PlatformMigrationPanel initialExports={migrationExports} />
        </div>
      </section>
    </AppShell>
  );
}

import { AppShell } from '@/components/layout/app-shell';
import { AgentManager } from '@/components/agents/agent-manager';
import { listAgents } from '@/lib/server/agents';
import { listModels, listProviders } from '@/lib/server/providers';
import { readSandboxResourcePolicy } from '@/lib/server/sandbox-resources';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const [agents, models, providers, sandboxDefaults] = await Promise.all([
    listAgents(),
    listModels(),
    listProviders(),
    readSandboxResourcePolicy(),
  ]);

  const runningCount = agents.filter((agent) => agent.runtimeStatus === 'running').length;
  const discoveredCount = agents.filter((agent) => agent.source === 'discovered').length;
  const manualCount = agents.filter((agent) => agent.source === 'manual').length;
  const explicitBindingCount = agents.filter((agent) => !agent.inheritsDefaultModel).length;

  return (
    <AppShell currentPath="/agents" title="Agent 列表" description="把纳管、筛选、模型绑定、目录维护和沙箱资源控制压缩到一张连续操作的主从工作台。" badge="Agents">
      <section className="console-hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="page-eyebrow">Agent Operations</div>
            <h2 className="mt-3 text-[1.86rem] font-semibold leading-tight tracking-tight text-slate-900 md:text-[2.08rem]">
              用一个更紧凑的工作台，把 Agent 纳管、模型绑定、目录维护和资源控制真正串起来。
            </h2>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600">
              这页优先服务日常运营：快速筛选某个 Agent、批量下发模型、调整单个 Agent 的工作目录和沙箱资源，再决定是否新建或删除。所有动作尽量保持在同一屏里连续完成。
            </p>
          </div>
          <div className="grid min-w-[260px] gap-3 sm:grid-cols-2 xl:max-w-[360px]">
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">已纳管 Agent</div>
              <div className="mt-2 text-[1.5rem] font-semibold tracking-tight text-slate-900">{agents.length}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">运行中</div>
              <div className="mt-2 text-[1.5rem] font-semibold tracking-tight text-slate-900">{runningCount}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">自动发现</div>
              <div className="mt-2 text-[1.3rem] font-semibold tracking-tight text-slate-900">{discoveredCount}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">手动维护</div>
              <div className="mt-2 text-[1.3rem] font-semibold tracking-tight text-slate-900">{manualCount}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">显式绑定 {explicitBindingCount}</span>
          <span className="pill-badge">继承默认 {agents.length - explicitBindingCount}</span>
          <span className="pill-badge">可用模型 {models.length}</span>
          <span className="pill-badge">默认 CPU {sandboxDefaults.cpus ?? '未限制'}</span>
        </div>

        <div className="console-note mt-5">
          模型路由优先级：<strong className="font-semibold text-slate-900">Agent 显式绑定</strong> &gt; <strong className="font-semibold text-slate-900">平台默认模型</strong>。沙箱资源优先级：<strong className="font-semibold text-slate-900">Agent 单独覆盖</strong> &gt; <strong className="font-semibold text-slate-900">系统默认策略</strong>。
        </div>
      </section>

      <AgentManager
        agents={agents}
        models={models.map((item) => ({
          id: item.id,
          label: `${item.displayName} · ${item.providerId}${item.isDefault ? ' · 默认' : ''}${item.providerId === 'default' && item.modelId.toLowerCase().startsWith('glm-') ? ' · 不建议 Agent 使用' : ''}`,
          providerId: item.providerId,
          modelId: item.modelId,
          isDefault: item.isDefault
        }))}
        providers={providers}
        sandboxDefaults={sandboxDefaults}
      />
    </AppShell>
  );
}

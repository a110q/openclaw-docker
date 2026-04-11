import { AppShell } from '@/components/layout/app-shell';
import { StatusCard } from '@/components/cards/status-card';
import { DefaultModelPicker } from '@/components/models/default-model-picker';
import { AgentBindingsManager } from '@/components/models/agent-bindings-manager';
import { listModels } from '@/lib/server/providers';
import { listAgents } from '@/lib/server/agents';

export const dynamic = 'force-dynamic';

export default async function ModelBindingsPage({ searchParams }: { searchParams?: Promise<{ agent?: string }> }) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const focusAgentId = typeof resolvedSearchParams?.agent === 'string' ? resolvedSearchParams.agent : '';
  const [models, agents] = await Promise.all([listModels(), listAgents()]);
  const defaultModel = models.find((item) => item.isDefault)?.id;
  const modelOptions = models.map((item) => ({ id: item.id, label: `${item.displayName} · ${item.providerId}` }));
  const explicitBindings = agents.filter((item) => !item.inheritsDefaultModel).length;

  return (
    <AppShell currentPath="/models/bindings" title="模型绑定" description="把默认模型与 Agent 级模型路由放进一张更紧凑、更好扫读的配置桌面。" badge="Model Routing">
      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.18fr)_360px]">
        <div className="console-hero">
          <div className="page-eyebrow">Binding Overview</div>
          <h2 className="mt-3 text-[1.9rem] font-semibold leading-tight tracking-tight text-slate-900 md:text-[2.2rem]">
            先定平台默认模型，再把路由精确落到每个 Agent。
          </h2>
          <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600">
            默认模型负责兜底，Agent 级绑定负责精细路由。页面里也直接写明优先级，避免“18889 改了但 18789 看起来没变”的错觉。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">默认模型 {defaultModel || '未配置'}</span>
            <span className="pill-badge">显式绑定 {explicitBindings}</span>
            <span className="pill-badge">可用模型 {models.length}</span>
          </div>
          <div className="console-note mt-5">
            路由优先级：<strong className="font-semibold text-slate-900">Agent 显式绑定</strong> &gt; <strong className="font-semibold text-slate-900">平台默认模型</strong>。如果已有历史会话，Control UI 里还可能显示旧 session cache，需要新会话或重载后再确认。
          </div>
          {focusAgentId ? (
            <div className="mt-4 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              当前已高亮 Agent：`{focusAgentId}`
            </div>
          ) : null}
        </div>

        <div className="surface-panel p-5 md:p-6">
          <div className="page-eyebrow">Summary</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">当前默认模型</div>
              <div className="mt-2 break-words text-[1.08rem] font-semibold tracking-tight text-slate-900">{defaultModel || '未配置'}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">已纳管 Agent</div>
              <div className="mt-2 text-[1.45rem] font-semibold tracking-tight text-slate-900">{agents.length}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">显式绑定</div>
              <div className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">{explicitBindings}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">可用模型</div>
              <div className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">{models.length}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="console-stat-grid">
        <StatusCard title="默认模型" value={defaultModel || '未配置'} hint="平台兜底路由" />
        <StatusCard title="显式绑定" value={String(explicitBindings)} hint="优先覆盖平台默认模型" tone={explicitBindings > 0 ? 'good' : 'default'} />
        <StatusCard title="已纳管 Agent" value={String(agents.length)} hint="参与模型路由的 Agent 数量" />
        <StatusCard title="可用模型" value={String(models.length)} hint="绑定页可直接选择的模型数" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
        <div className="surface-panel p-5 md:p-6 xl:sticky xl:top-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">平台默认模型</h2>
            <span className="pill-badge">Default</span>
          </div>
          <p className="mt-2 muted-copy">默认模型会作为新 Agent 或继承模式下的首选模型来源。</p>
          <div className="mt-4">
            <DefaultModelPicker models={modelOptions} defaultModelId={defaultModel} />
          </div>
        </div>

        <div className="surface-panel p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">Agent 级绑定</h2>
            <span className="pill-badge">Per Agent</span>
          </div>
          <p className="mt-2 muted-copy">每个 Agent 单独指定主模型，更适合做角色分工、成本控制和能力隔离。</p>
          <div className="mt-4">
            <AgentBindingsManager
              agents={agents.map((item) => ({ id: item.id, name: item.displayName, primaryModelId: item.primaryModelId }))}
              models={modelOptions}
              focusAgentId={focusAgentId}
            />
          </div>
        </div>
      </section>
    </AppShell>
  );
}

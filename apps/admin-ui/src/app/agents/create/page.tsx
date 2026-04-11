import { AppShell } from '@/components/layout/app-shell';
import { StatusCard } from '@/components/cards/status-card';
import { BatchCreateForm } from '@/components/agents/batch-create-form';
import { listModels } from '@/lib/server/providers';

export const dynamic = 'force-dynamic';

export default async function AgentCreatePage() {
  const models = await listModels();
  return (
    <AppShell currentPath="/agents/create" title="批量创建" description="按前缀和数量批量生成多个 Agent，适用于多人协同或多模型分工。" badge="Batch Create">
      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="console-hero">
          <div className="page-eyebrow">Batch Agent Composer</div>
          <h2 className="mt-3 text-[1.95rem] font-semibold leading-tight tracking-tight text-slate-900 md:text-[2.22rem]">
            一次定义规则，批量生成多个可直接纳管的 Agent。
          </h2>
          <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600">
            批量创建页适合多人协同、多模型分工或一组固定职责 Agent 的快速初始化。除了创建记录本身，它还会把工作目录和模型路由一并写好。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">模型目录 {models.length}</span>
            <span className="pill-badge">命名规则 prefix-001</span>
            <span className="pill-badge">同步写入 openclaw.json</span>
          </div>
        </div>

        <div className="surface-panel p-5 md:p-6">
          <div className="page-eyebrow">Create Notes</div>
          <div className="mt-4 space-y-3">
            <div className="surface-soft px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">命名预览</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">`ops` + 3 + 起始 1 ⇒ `ops-001` / `ops-002` / `ops-003`</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">同步落盘</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">会同时创建 workspace 和 agent 目录，并把主模型写入 `openclaw.json`。</div>
            </div>
          </div>
        </div>
      </section>

      <section className="console-stat-grid">
        <StatusCard title="可用模型" value={String(models.length)} hint="用于批量创建时选择主模型" tone={models.length > 0 ? 'good' : 'default'} />
        <StatusCard title="命名模式" value="prefix-序号" hint="自动补齐三位编号" />
        <StatusCard title="目录创建" value="自动完成" hint="workspace 与 agent 目录一并创建" />
        <StatusCard title="配置写入" value="同步更新" hint="创建时同时写入 openclaw.json" />
      </section>

      <section className="surface-panel p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">批量创建参数</h2>
          <span className="pill-badge">Composer</span>
        </div>
        <div className="mt-4">
          <BatchCreateForm models={models.map((item) => ({ id: item.id, label: `${item.displayName} · ${item.providerId}` }))} />
        </div>
      </section>
    </AppShell>
  );
}

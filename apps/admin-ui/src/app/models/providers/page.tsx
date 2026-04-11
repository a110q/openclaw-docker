import { AppShell } from '@/components/layout/app-shell';
import { StatusCard } from '@/components/cards/status-card';
import { ProviderManager } from '@/components/models/provider-manager';
import { listModels, listProviders } from '@/lib/server/providers';

export const dynamic = 'force-dynamic';

export default async function ProvidersPage() {
  const [providers, models] = await Promise.all([listProviders(), listModels()]);
  const defaultProviders = providers.filter((provider) => provider.isDefault).length;
  const customProviders = providers.length - defaultProviders;
  const healthyTests = providers.filter((provider) => provider.lastTestStatus === 'ok').length;

  return (
    <AppShell currentPath="/models/providers" title="Provider 管理" description="把模型上游、默认 Provider 和模型目录收进一张更清爽的配置工作台。" badge="Providers">
      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="console-hero">
          <div className="page-eyebrow">Model Providers</div>
          <h2 className="mt-3 text-[1.9rem] font-semibold leading-tight tracking-tight text-slate-900 md:text-[2.2rem]">
            统一维护上游模型入口，再把默认路由和模型目录压进同一页。
          </h2>
          <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600">
            这里适合集中管理 API Key、Base URL、默认 Provider 和模型目录。页面风格现在统一到更轻、更规整的控制台布局，编辑、测试和查看目录不再像三块分散表单。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">Provider {providers.length}</span>
            <span className="pill-badge">默认 {defaultProviders}</span>
            <span className="pill-badge">模型目录 {models.length}</span>
          </div>
        </div>

        <div className="surface-panel p-5 md:p-6">
          <div className="page-eyebrow">Summary</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">可用 Provider</div>
              <div className="mt-2 text-[1.5rem] font-semibold tracking-tight text-slate-900">{providers.length}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">测试正常</div>
              <div className="mt-2 text-[1.5rem] font-semibold tracking-tight text-slate-900">{healthyTests}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">默认 Provider</div>
              <div className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">{defaultProviders}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">自定义 Provider</div>
              <div className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">{customProviders}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="console-stat-grid">
        <StatusCard title="Provider 总数" value={String(providers.length)} hint="所有已保存的模型上游入口" />
        <StatusCard title="默认 Provider" value={String(defaultProviders)} hint="承担平台默认路由" tone={defaultProviders > 0 ? 'good' : 'default'} />
        <StatusCard title="自定义 Provider" value={String(customProviders)} hint="额外接入的第三方或内网网关" />
        <StatusCard title="模型目录" value={String(models.length)} hint="后台可直接选择的模型数" />
      </section>

      <ProviderManager providers={providers} />

      <section className="surface-panel p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title">模型目录</h2>
            <p className="mt-1 muted-copy">把可用模型压成更紧凑的目录视图，便于扫读 Provider 与模型关系。</p>
          </div>
          <span className="pill-badge">{models.length} Models</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {models.map((model) => (
            <div key={model.id} className="metric-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{model.displayName}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{model.id}</div>
                </div>
                {model.isDefault ? <span className="pill-badge border-emerald-200 bg-emerald-50 text-emerald-700">默认</span> : null}
              </div>
              <div className="mt-3 text-[13px] leading-6 text-slate-600">Provider：{model.providerId}</div>
              <div className="mt-2 text-xs text-slate-500">能力：{model.capabilities.join(', ')}</div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

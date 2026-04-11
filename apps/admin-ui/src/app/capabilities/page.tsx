import { CapabilityConsole } from '@/components/capabilities/capability-console';
import { AppShell } from '@/components/layout/app-shell';
import { StatusCard } from '@/components/cards/status-card';
import { listHostCapabilities } from '@/lib/server/host-capabilities/registry';

export const dynamic = 'force-dynamic';

export default async function CapabilitiesPage() {
  const capabilities = listHostCapabilities();
  const readCount = capabilities.filter((item) => item.riskLevel === 'read').length;
  const writeCount = capabilities.filter((item) => item.riskLevel === 'write').length;
  const dangerCount = capabilities.filter((item) => item.riskLevel === 'danger').length;
  const confirmCount = capabilities.filter((item) => item.requiresConfirmation).length;

  return (
    <AppShell
      currentPath="/capabilities"
      title="宿主机能力"
      description="把常见宿主机级操作收敛为可预览、可确认、可审计的能力通道，避免 Agent 在 sandbox 里直接报做不到。"
      badge="Host Capability API"
    >
      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="console-hero">
          <div className="page-eyebrow">Host Capability Layer</div>
          <h2 className="mt-3 text-[1.95rem] font-semibold leading-tight tracking-tight text-slate-900 md:text-[2.22rem]">
            用白名单能力代理宿主机操作，而不是让 sandbox 直接越权。
          </h2>
          <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600">
            这里解决的不是“让 Agent 直接拿到宿主机权限”，而是把高价值操作包装成可预览、可确认、可审计的能力入口，既保证可用性，也守住安全边界。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">总能力 {capabilities.length}</span>
            <span className="pill-badge">需确认 {confirmCount}</span>
            <span className="pill-badge">高风险 {dangerCount}</span>
          </div>
        </div>

        <div className="surface-panel p-5 md:p-6">
          <div className="page-eyebrow">Safety Notes</div>
          <div className="mt-4 space-y-3">
            <div className="surface-soft px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">为什么不直接给 sandbox 宿主机权限</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">因为大部分问题不是“做不到”，而是需要一条可预览、可确认、可审计的安全通路。</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-sm font-semibold text-slate-900">适合放在这里的能力</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">服务重载、飞书写入、Compose 状态读取、配置影响预览等宿主级动作。</div>
            </div>
            <div className="console-note">如果某个问题本质上需要改宿主机配置、重启服务或暴露回调地址，就应该优先走这里，而不是要求 sandbox 直接越权执行。</div>
          </div>
        </div>
      </section>

      <section className="console-stat-grid">
        <StatusCard title="只读能力" value={String(readCount)} hint="获取状态、日志和预览类操作" />
        <StatusCard title="写入能力" value={String(writeCount)} hint="会修改配置或元数据" tone={writeCount > 0 ? 'good' : 'default'} />
        <StatusCard title="危险能力" value={String(dangerCount)} hint="可能影响服务可用性" tone={dangerCount > 0 ? 'warn' : 'default'} />
        <StatusCard title="需确认" value={String(confirmCount)} hint="执行前必须二次确认" tone={confirmCount > 0 ? 'warn' : 'default'} />
      </section>

      <CapabilityConsole capabilities={capabilities} />
    </AppShell>
  );
}

import { AppShell } from '@/components/layout/app-shell';
import { StatusCard } from '@/components/cards/status-card';
import { DiscoveryScanner } from '@/components/agents/discovery-scanner';
import { resolveAgentStorageRoots } from '@/lib/server/agent-storage';

export const dynamic = 'force-dynamic';

export default async function AgentDiscoveryPage() {
  const storage = await resolveAgentStorageRoots();

  return (
    <AppShell currentPath="/agents/discovery" title="自动扫描" description="把宿主机上的 Agent 目录变成可阅读、可判断、可导入的候选列表，而不是生硬的扫描结果块。" badge="Discovery">
      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.18fr)_360px]">
        <div className="console-hero">
          <div className="page-eyebrow">Agent Discovery</div>
          <h2 className="mt-3 text-[1.95rem] font-semibold leading-tight tracking-tight text-slate-900 md:text-[2.2rem]">
            先扫描，再挑选，再纳管。
          </h2>
          <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600">
            自动扫描页现在更像一张纳管工作台：左边执行扫描与导入，右边把规则和路径边界讲清楚，避免只看到一串目录却不知道该不该导入。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">Agent Root 已配置</span>
            <span className="pill-badge">导入后自动写后台元数据</span>
          </div>
        </div>

        <div className="surface-panel p-5 md:p-6">
          <div className="page-eyebrow">Scope</div>
          <div className="mt-4 space-y-3">
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">当前 Agent 根目录</div>
              <div className="mt-2 break-all text-[13px] font-medium leading-6 text-slate-800">{storage.agentDirRootAbsolute}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">目录规则来源</div>
              <div className="mt-2 text-[1rem] font-semibold tracking-tight text-slate-900">系统设置 → Agent 数据目录</div>
            </div>
          </div>
        </div>
      </section>

      <section className="console-stat-grid">
        <StatusCard title="扫描来源" value="当前 Agent 根目录" hint={storage.agentDirRootAbsolute} tone="good" />
        <StatusCard title="纳管结果" value="写入后台元数据" hint="导入成功后纳入后台列表" />
        <StatusCard title="目录规则" value="相对宿主根目录" hint="避免越出宿主机数据边界" />
        <StatusCard title="判断方式" value="按状态分类" hint="discoverable / already-managed / invalid" />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px] 2xl:items-start">
        <div className="surface-panel p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">扫描与导入</h2>
            <span className="pill-badge">Control</span>
          </div>
          <p className="mt-2 muted-copy">先扫描当前配置的 Agent 根目录，再把真正可导入的 Agent 作为候选项纳入后台管理。</p>
          <div className="mt-4">
            <DiscoveryScanner />
          </div>
        </div>

        <div className="surface-panel p-5 md:p-6 2xl:sticky 2xl:top-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">判断标准</h2>
            <span className="pill-badge">Heuristics</span>
          </div>
          <div className="mt-4 space-y-3">
            <div className="surface-soft px-4 py-4 text-sm leading-7 text-slate-600">`discoverable`：可直接导入。</div>
            <div className="surface-soft px-4 py-4 text-sm leading-7 text-slate-600">`already-managed`：已在后台管理范围内。</div>
            <div className="surface-soft px-4 py-4 text-sm leading-7 text-slate-600">`invalid / ignored`：目录结构不完整或不符合规则。</div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

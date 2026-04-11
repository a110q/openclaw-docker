import { PlatformShell } from '@/components/platform/platform-shell';
import { getPlatformDashboard } from '@/lib/server/platform-repo';
import { requirePlatformUser } from '@/lib/server/platform-session';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePlatformUser();
  const dashboard = await getPlatformDashboard(user.id);
  const resolved = await searchParams;
  const welcome = resolved.welcome === '1';

  return (
    <PlatformShell
      currentPath="/home"
      title="我的空间"
      description="这里是你的个人工作台，只展示与你自己的龙虾、模型和绑定关系有关的内容。平台运维、宿主机和告警配置由管理员独立维护。"
      user={user}
    >
      {welcome ? (
        <section className="surface-panel px-5 py-4 text-[14px] leading-6 text-slate-600 md:px-6">
          欢迎加入，默认龙虾已经为你创建完成。接下来可以先去“我的龙虾”查看运行态，再去“我的模型”补充你自己的模型接口。
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-4">
        <div className="metric-card">
          <div className="page-eyebrow">My Lobsters</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{dashboard.lobsterCount}</div>
          <div className="mt-2 text-[13px] leading-6 text-slate-600">已纳入你个人工作空间的龙虾数量。</div>
        </div>
        <div className="metric-card">
          <div className="page-eyebrow">Runtime Sync</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{dashboard.syncedLobsterCount}</div>
          <div className="mt-2 text-[13px] leading-6 text-slate-600">已同步为运行态实例的龙虾数量。</div>
        </div>
        <div className="metric-card">
          <div className="page-eyebrow">My Models</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{dashboard.providerCount}</div>
          <div className="mt-2 text-[13px] leading-6 text-slate-600">你录入到个人空间中的私有模型入口数量。</div>
        </div>
        <div className="metric-card">
          <div className="page-eyebrow">Model Sync</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{dashboard.syncedProviderCount}</div>
          <div className="mt-2 text-[13px] leading-6 text-slate-600">其中已经可被你的龙虾直接绑定使用的模型数量。</div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <div className="surface-panel px-5 py-5 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="page-eyebrow">Default Lobster</div>
              <h2 className="mt-2 text-[1.5rem] font-semibold tracking-tight text-slate-900">
                {dashboard.defaultLobster?.name || '还没有龙虾'}
              </h2>
            </div>
            <span className="pill-badge">{dashboard.defaultLobster?.runtimeSyncStatus === 'synced' ? '运行中' : '待同步'}</span>
          </div>
          <p className="mt-3 text-[14px] leading-6 text-slate-600">
            默认龙虾是你注册后自动获得的第一只龙虾。后续每新增一只龙虾，平台都会为它建立个人空间记录，并尝试同步成运行态实例。
          </p>

          {dashboard.defaultLobster ? (
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="surface-soft px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">原型</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{dashboard.defaultLobster.archetype}</div>
              </div>
              <div className="surface-soft px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">主模型</div>
                <div className="mt-2 break-all text-sm font-semibold text-slate-900">{dashboard.defaultLobster.modelRef}</div>
              </div>
              <div className="surface-soft px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">运行态实例</div>
                <div className="mt-2 break-all text-sm font-semibold text-slate-900">{dashboard.defaultLobster.runtimeAgentId || '未生成'}</div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="surface-panel px-5 py-5 md:px-6">
          <div className="page-eyebrow">Quick Route</div>
          <h2 className="mt-2 text-[1.42rem] font-semibold tracking-tight text-slate-900">下一步</h2>
          <div className="mt-4 space-y-3">
            <a href="/lobsters" className="list-row block">
              <div className="text-sm font-semibold text-slate-900">继续孵化龙虾</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-600">手动新增多只龙虾，并给不同龙虾绑定不同模型。</div>
            </a>
            <a href="/models" className="list-row block">
              <div className="text-sm font-semibold text-slate-900">补充我的模型</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-600">录入你自己的 OpenAI-compatible / Claude / Gemini / Ollama 模型入口。</div>
            </a>
            <a href="/chat" className="list-row block">
              <div className="text-sm font-semibold text-slate-900">开始使用龙虾</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-600">进入对话台，直接和你选择的龙虾聊天、下达任务、体验实际能力。</div>
            </a>
          </div>
        </div>
      </section>
    </PlatformShell>
  );
}

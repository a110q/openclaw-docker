import { PlatformShell } from '@/components/platform/platform-shell';
import { bindLobsterModelAction, createLobsterAction, deleteLobsterAction, updateLobsterAction } from '@/lib/server/platform-actions';
import { listAvailableModelChoices, listPlatformLobsters, listPlatformProviders } from '@/lib/server/platform-repo';
import { requirePlatformUser } from '@/lib/server/platform-session';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LobstersPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePlatformUser();
  const [lobsters, choices, providers] = await Promise.all([
    listPlatformLobsters(user.id),
    listAvailableModelChoices(user.id),
    listPlatformProviders(user.id),
  ]);
  const resolved = await searchParams;
  const error = typeof resolved.error === 'string' ? decodeURIComponent(resolved.error) : '';
  const created = resolved.created === '1';
  const updated = resolved.updated === '1';
  const deleted = resolved.deleted === '1';

  return (
    <PlatformShell
      currentPath="/lobsters"
      title="我的龙虾"
      description="这里不仅能创建龙虾，还能维护它们的名称、原型、主模型绑定，并删除不再需要的龙虾。"
      user={user}
    >
      {created ? <section className="notice-success">已创建新的龙虾。</section> : null}
      {updated ? <section className="notice-success">已更新龙虾信息。</section> : null}
      {deleted ? <section className="notice-success">已删除龙虾。</section> : null}
      {error ? <section className="notice-error">{error}</section> : null}

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <form action={createLobsterAction} className="surface-panel space-y-4 px-5 py-5 md:px-6">
          <div>
            <div className="page-eyebrow">Create Lobster</div>
            <h2 className="mt-2 text-[1.42rem] font-semibold tracking-tight text-slate-900">新增龙虾</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">创建后会进入你的个人工作区，并尝试同步生成对应的运行态实例。</p>
          </div>

          <label className="block">
            <span className="field-label">名称</span>
            <input name="name" className="field" placeholder="例如：代码龙虾 / 运营龙虾" />
          </label>
          <label className="block">
            <span className="field-label">原型</span>
            <input name="archetype" className="field" placeholder="例如：代码型 / 分析型 / 陪伴型" />
          </label>

          <button type="submit" className="btn-primary w-full justify-center">创建我的龙虾</button>
        </form>

        <section className="surface-panel px-5 py-5 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="page-eyebrow">Lobster Fleet</div>
              <h2 className="mt-2 text-[1.42rem] font-semibold tracking-tight text-slate-900">龙虾列表</h2>
            </div>
            <span className="pill-badge">{lobsters.length} 只</span>
          </div>

          <div className="mt-5 space-y-4">
            {lobsters.map((lobster) => {
              const currentProvider = providers.find((item) => item.id === lobster.providerId);
              return (
                <div key={lobster.id} className="list-row space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-base font-semibold text-slate-900">{lobster.name}</div>
                    {lobster.isDefault ? <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">默认龙虾</span> : null}
                    <span className="pill-badge">{lobster.runtimeSyncStatus === 'synced' ? '运行态已同步' : lobster.runtimeSyncStatus === 'failed' ? '同步失败' : '待同步'}</span>
                  </div>
                  <div className="text-[13px] leading-6 text-slate-600">{lobster.archetype} · 当前模型 `{lobster.modelRef}`</div>
                  <div className="text-xs text-slate-500">运行态实例：{lobster.runtimeAgentId || '未生成'}{currentProvider ? ` · 我的模型：${currentProvider.name}` : ''}</div>
                  {lobster.runtimeSyncError ? <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{lobster.runtimeSyncError}</div> : null}

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <form action={updateLobsterAction} className="surface-soft space-y-3 px-4 py-4">
                      <input type="hidden" name="lobsterId" value={lobster.id} />
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">基础资料</div>
                      <label className="block">
                        <span className="field-label">名称</span>
                        <input name="name" defaultValue={lobster.name} className="field" />
                      </label>
                      <label className="block">
                        <span className="field-label">原型</span>
                        <input name="archetype" defaultValue={lobster.archetype} className="field" />
                      </label>
                      <button type="submit" className="btn-secondary w-full justify-center">保存资料</button>
                    </form>

                    <div className="surface-soft space-y-3 px-4 py-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">模型与生命周期</div>
                      <form action={bindLobsterModelAction} className="space-y-3">
                        <input type="hidden" name="lobsterId" value={lobster.id} />
                        <label className="block">
                          <span className="field-label">切换主模型</span>
                          <select name="modelRef" defaultValue={lobster.modelRef} className="field min-w-0">
                            {choices.map((choice) => (
                              <option key={choice.id} value={choice.id}>{choice.label}</option>
                            ))}
                          </select>
                        </label>
                        <button type="submit" className="btn-secondary w-full justify-center">保存绑定</button>
                      </form>
                      <form action={deleteLobsterAction}>
                        <input type="hidden" name="lobsterId" value={lobster.id} />
                        <button type="submit" className="btn-danger w-full justify-center">删除这只龙虾</button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}

            {!lobsters.length ? (
              <div className="surface-soft px-4 py-5 text-[13px] leading-6 text-slate-600">
                当前还没有龙虾。先在左侧创建第一只，它会先进入你的个人工作区，再尝试同步为运行态实例。
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </PlatformShell>
  );
}

import { PlatformShell } from '@/components/platform/platform-shell';
import { PlatformCollabNav } from '@/components/platform/platform-collab-nav';
import { ClawSwarmSyncButton } from '@/components/platform/clawswarm-sync-button';
import { readPlatformSwarmOverview } from '@/lib/server/platform-clawswarm';
import { readPlatformClawSwarmRuntimeSnapshot } from '@/lib/server/platform-clawswarm-runtime';
import { requirePlatformUser } from '@/lib/server/platform-session';

function formatTime(value?: string) {
  if (!value) return '暂无';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export default async function ChatOpenClawsPage() {
  const user = await requirePlatformUser();
  const [overview, runtime] = await Promise.all([
    readPlatformSwarmOverview(user.id),
    readPlatformClawSwarmRuntimeSnapshot(),
  ]);

  return (
    <PlatformShell
      currentPath="/chat"
      title="协作中心"
      description="这里承接 ClawSwarm 的平台化实例接入视图：平台侧管理你的 workspace 与成员映射，运行时侧展示真实接入的 OpenClaw 实例、Agent 通讯录与群组。"
      user={user}
    >
      <PlatformCollabNav currentPath="/chat/openclaws" service={overview.service} memberCount={overview.counts.totalMembers} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_380px]">
        <div className="surface-panel px-5 py-5 md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="page-eyebrow">Workspace</div>
              <h2 className="mt-2 text-[1.42rem] font-semibold tracking-tight text-slate-900">我的协作工作区</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-600">
                平台已经为当前账号生成独立的 swarm workspace，并把你名下龙虾映射为待协作成员。右侧运行时状态则反映 ClawSwarm 当前真正接入了哪些 OpenClaw 实例。
              </p>
            </div>
            <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">{overview.workspace.status}</span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">Tenant Key</div>
              <div className="mt-2 break-all text-sm font-semibold text-slate-900">{overview.workspace.swarmTenantKey}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">ClawSwarm</div>
              <div className="mt-2 break-all text-sm font-semibold text-slate-900">{overview.service.publicUrl}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">最近同步</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{formatTime(overview.workspace.lastSyncAt)}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {overview.members.length ? overview.members.map((member) => (
              <div key={member.id} className="rounded-[22px] border border-slate-200 bg-white/92 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-900">{member.displayName}</div>
                  <span className="pill-badge">{member.syncStatus}</span>
                  <span className="pill-badge">{member.runtimeSyncStatus === 'synced' ? '运行态就绪' : member.runtimeSyncStatus}</span>
                </div>
                <div className="mt-2 text-[13px] leading-6 text-slate-600">{member.archetype} · {member.modelRef}</div>
                <div className="mt-1 break-all text-xs text-slate-500">runtimeAgentId：{member.runtimeAgentId || '未生成'}</div>
                {member.syncError ? <div className="notice-error mt-3">{member.syncError}</div> : null}
              </div>
            )) : (
              <div className="surface-soft px-4 py-5 text-[13px] leading-6 text-slate-600">
                你目前还没有可映射到协作实例的龙虾。先去“我的龙虾”创建至少一只。
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-panel px-5 py-5 md:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="page-eyebrow">Runtime Instances</div>
                <h2 className="mt-2 text-[1.3rem] font-semibold tracking-tight text-slate-900">已接入的 OpenClaw 实例</h2>
              </div>
              <span className="pill-badge">Runtime</span>
            </div>
            <div className="mt-4">
              <ClawSwarmSyncButton />
            </div>
            <div className="mt-4 space-y-3">
              {runtime.instances.length ? runtime.instances.map((instance) => (
                <div key={instance.id} className="surface-soft px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">{instance.name}</div>
                    <span className="pill-badge">{instance.runtimeStatus}</span>
                    <span className="pill-badge">Agent {instance.agentCount}</span>
                  </div>
                  <div className="mt-2 break-all text-[13px] leading-6 text-slate-600">{instance.channelBaseUrl}</div>
                  <div className="mt-2 text-xs text-slate-500">accountId：{instance.channelAccountId} · 最近更新：{formatTime(instance.updatedAt)}</div>
                </div>
              )) : (
                <div className="surface-soft px-4 py-5 text-[13px] leading-6 text-slate-600">
                  当前还没有任何 OpenClaw 实例接入到 ClawSwarm。通常是因为还没执行 connect/sync，或者 Gateway 侧 clawswarm channel 插件尚未可用。
                </div>
              )}
            </div>
          </div>

          <div className="surface-panel px-5 py-5 md:px-6">
            <div className="page-eyebrow">Runtime Groups</div>
            <h2 className="mt-2 text-[1.24rem] font-semibold tracking-tight text-slate-900">群组与通讯录</h2>
            <div className="mt-4 space-y-3">
              {runtime.groups.length ? runtime.groups.slice(0, 4).map((group) => (
                <div key={group.id} className="surface-soft px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">{group.name}</div>
                    <span className="pill-badge">成员 {group.memberCount}</span>
                  </div>
                  <div className="mt-2 text-[13px] leading-6 text-slate-600">{group.description || '暂无描述'}</div>
                </div>
              )) : (
                <div className="surface-soft px-4 py-5 text-[13px] leading-6 text-slate-600">
                  运行时通讯录里暂时还没有群组。等后续开始多龙虾协作或创建群聊后，这里会自动同步展示。
                </div>
              )}
            </div>
            {runtime.warnings.length ? (
              <div className="mt-4 space-y-3">
                {runtime.warnings.slice(0, 3).map((warning) => (
                  <div key={warning} className="surface-soft px-4 py-4 text-[13px] leading-6 text-slate-600">{warning}</div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </PlatformShell>
  );
}

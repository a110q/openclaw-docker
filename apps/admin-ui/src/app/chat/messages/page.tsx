import { PlatformShell } from '@/components/platform/platform-shell';
import { PlatformChatConsole } from '@/components/platform/platform-chat-console';
import { PlatformCollabNav } from '@/components/platform/platform-collab-nav';
import { readPlatformSwarmOverview } from '@/lib/server/platform-clawswarm';
import { readPlatformClawSwarmChatWorkspace } from '@/lib/server/platform-clawswarm-chat';
import { requirePlatformUser } from '@/lib/server/platform-session';

export default async function ChatMessagesPage() {
  const user = await requirePlatformUser();
  const [overview, workspace] = await Promise.all([
    readPlatformSwarmOverview(user.id),
    readPlatformClawSwarmChatWorkspace(user.id),
  ]);

  const syncedCount = workspace.targets.filter((item) => item.runtimeSyncStatus === 'synced').length;
  const degradedCount = workspace.targets.filter((item) => item.runtimeSyncStatus !== 'synced').length;

  return (
    <PlatformShell
      currentPath="/chat"
      title="协作中心"
      description="这里是当前用户自己的聊天与协作空间：同步到 ClawSwarm 的龙虾走真实运行时会话，未同步的龙虾保留平台本地对话模式。"
      user={user}
    >
      <PlatformCollabNav
        currentPath="/chat/messages"
        service={overview.service}
        memberCount={overview.counts.totalMembers}
      />

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="surface-panel px-5 py-5 md:px-6">
          <div className="page-eyebrow">My Collaboration Space</div>
          <h3 className="mt-2 text-[1.38rem] font-semibold tracking-tight text-slate-900">
            用户聊天页已切到“我的龙虾会话”视角
          </h3>
          <p className="mt-3 max-w-[72ch] text-[13px] leading-6 text-slate-600">
            已同步龙虾直接接入 ClawSwarm 持久会话，刷新后消息仍在；未同步龙虾继续走平台本地模式，并在当前浏览器保存聊天记录，避免刷新丢失。
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="surface-soft px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">我的龙虾</div>
              <div className="mt-2 text-[1.35rem] font-semibold text-slate-900">{workspace.targets.length}</div>
              <div className="mt-1 text-[12px] text-slate-500">当前账号名下可用对话入口</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">运行时会话</div>
              <div className="mt-2 text-[1.35rem] font-semibold text-slate-900">{workspace.recentConversations.length}</div>
              <div className="mt-1 text-[12px] text-slate-500">仅展示属于当前用户的 ClawSwarm direct 会话</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">已同步</div>
              <div className="mt-2 text-[1.35rem] font-semibold text-slate-900">{syncedCount}</div>
              <div className="mt-1 text-[12px] text-slate-500">可走运行时持久消息链路</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">本地模式</div>
              <div className="mt-2 text-[1.35rem] font-semibold text-slate-900">{degradedCount}</div>
              <div className="mt-1 text-[12px] text-slate-500">未同步时仍可聊天，记录保存在浏览器</div>
            </div>
          </div>
        </div>

        <div className="surface-panel px-5 py-5 md:px-6">
          <div className="page-eyebrow">Runtime Policy</div>
          <h3 className="mt-2 text-[1.2rem] font-semibold tracking-tight text-slate-900">当前协作模式</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">消息刷新不丢</span>
            <span className="pill-badge">用户隔离视图</span>
            <span className="pill-badge">Direct Conversation</span>
            <span className="pill-badge">
              中间过程 {overview.settings.preferences.showIntermediateMessages ? '显示' : '隐藏'}
            </span>
          </div>
          <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50/88 px-4 py-4 text-[13px] leading-6 text-slate-600">
            用户看到的是自己的聊天工作台，不再直接暴露整个平台的运行时列表。若某只龙虾未同步到 ClawSwarm，页面会自动退回到平台本地对话模式。
          </div>
          {overview.service.diagnostics.length ? (
            <div className="mt-3 space-y-2">
              {overview.service.diagnostics.slice(0, 2).map((item) => (
                <div key={item} className="rounded-[18px] border border-slate-200 bg-white/90 px-3 py-3 text-[12px] leading-5 text-slate-500">
                  {item}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <PlatformChatConsole initialWorkspace={workspace} showIntermediateMessages={overview.settings.preferences.showIntermediateMessages} />
    </PlatformShell>
  );
}

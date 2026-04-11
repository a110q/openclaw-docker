import { PlatformShell } from '@/components/platform/platform-shell';
import { PlatformCollabNav } from '@/components/platform/platform-collab-nav';
import { readPlatformSwarmOverview } from '@/lib/server/platform-clawswarm';
import { readPlatformClawSwarmRuntimeSnapshot } from '@/lib/server/platform-clawswarm-runtime';
import { requirePlatformUser } from '@/lib/server/platform-session';

function formatTime(value?: string) {
  if (!value) return '暂无';
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export default async function ChatTasksPage() {
  const user = await requirePlatformUser();
  const [overview, runtime] = await Promise.all([
    readPlatformSwarmOverview(user.id),
    readPlatformClawSwarmRuntimeSnapshot(),
  ]);

  const taskCounts = {
    pending: runtime.tasks.filter((item) => item.status === 'pending').length,
    running: runtime.tasks.filter((item) => item.status === 'running').length,
    succeeded: runtime.tasks.filter((item) => item.status === 'succeeded').length,
    failed: runtime.tasks.filter((item) => item.status === 'failed').length,
  };

  return (
    <PlatformShell
      currentPath="/chat"
      title="协作中心"
      description="任务中心开始读取 ClawSwarm 运行时中的 agent dialogue / 协作会话状态，把它们整理成平台更容易理解的任务视图。"
      user={user}
    >
      <PlatformCollabNav currentPath="/chat/tasks" service={overview.service} memberCount={overview.counts.totalMembers} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="surface-panel px-5 py-5 md:px-6">
          <div className="page-eyebrow">Runtime Tasks</div>
          <h2 className="mt-2 text-[1.4rem] font-semibold tracking-tight text-slate-900">协作任务视图</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">等待中</div>
              <div className="mt-2 text-[1.18rem] font-semibold text-slate-900">{taskCounts.pending}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">运行中</div>
              <div className="mt-2 text-[1.18rem] font-semibold text-slate-900">{taskCounts.running}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">已完成</div>
              <div className="mt-2 text-[1.18rem] font-semibold text-slate-900">{taskCounts.succeeded}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">失败</div>
              <div className="mt-2 text-[1.18rem] font-semibold text-slate-900">{taskCounts.failed}</div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {runtime.tasks.length ? runtime.tasks.map((task) => (
              <div key={task.id} className="rounded-[22px] border border-slate-200 bg-white/92 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                  <span className="pill-badge">{task.status}</span>
                  {task.rawStatus ? <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">{task.rawStatus}</span> : null}
                </div>
                <div className="mt-2 text-[13px] leading-6 text-slate-600">
                  {task.sourceAgentName || task.targetAgentName
                    ? `${task.sourceAgentName || '未知发起方'} → ${task.targetAgentName || '未知目标方'}`
                    : '该任务由协作运行时会话派生而来'}
                </div>
                <div className="mt-2 text-[13px] leading-6 text-slate-600">{task.summary || '暂无摘要'}</div>
                <div className="mt-2 text-xs text-slate-500">最近活动：{formatTime(task.lastMessageAt)}</div>
              </div>
            )) : (
              <div className="surface-soft px-4 py-5 text-[13px] leading-6 text-slate-600">
                当前还没有可展示的协作任务。等 ClawSwarm 侧出现 agent dialogue 或多龙虾协作会话后，这里会自动生成对应的任务卡片。
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-panel px-5 py-5 md:px-6">
            <div className="page-eyebrow">Inputs</div>
            <h2 className="mt-2 text-[1.24rem] font-semibold tracking-tight text-slate-900">当前任务来源</h2>
            <div className="mt-4 space-y-3 text-[13px] leading-6 text-slate-600">
              <div className="surface-soft px-4 py-4">来源一：ClawSwarm 运行时中的 agent dialogue 会话。</div>
              <div className="surface-soft px-4 py-4">来源二：带有 dialogue 状态的 direct / group conversation。</div>
              <div className="surface-soft px-4 py-4">下一阶段再补任务详情、重试、取消和结果产物读取。</div>
            </div>
          </div>

          <div className="surface-panel px-5 py-5 md:px-6">
            <div className="page-eyebrow">Runtime Summary</div>
            <h2 className="mt-2 text-[1.24rem] font-semibold tracking-tight text-slate-900">底座摘要</h2>
            <div className="mt-4 space-y-3 text-[13px] leading-6 text-slate-600">
              <div className="surface-soft px-4 py-4">协作底座：{overview.service.reachable ? '已连通' : '待联通'}</div>
              <div className="surface-soft px-4 py-4">运行时实例：{runtime.instances.length} 个</div>
              <div className="surface-soft px-4 py-4">会话目录：{runtime.conversations.length} 条</div>
              <div className="surface-soft px-4 py-4">平台成员目录：{overview.counts.totalMembers} 个</div>
            </div>
          </div>
        </div>
      </section>
    </PlatformShell>
  );
}

import { AppShell } from '@/components/layout/app-shell';
import { StatusCard } from '@/components/cards/status-card';
import { listActivity } from '@/lib/server/activity';
import { listTasks } from '@/lib/server/tasks';

export const dynamic = 'force-dynamic';

function statusTone(status: string) {
  if (status === 'succeeded' || status === 'logged') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'running') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export default async function ActivityPage() {
  const [activity, tasks] = await Promise.all([listActivity(), listTasks()]);
  const failedTasks = tasks.filter((task) => task.status === 'failed').length;
  const runningTasks = tasks.filter((task) => task.status === 'running').length;
  const successCount = activity.filter((item) => item.status === 'succeeded' || item.status === 'logged').length;

  return (
    <AppShell currentPath="/activity" title="活动记录" description="把配置变更、服务控制和后台任务压成一条可回溯的运维时间流。" badge="Audit Trail">
      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="console-hero">
          <div className="page-eyebrow">Recent Timeline</div>
          <h2 className="mt-3 text-[1.95rem] font-semibold leading-tight tracking-tight text-slate-900 md:text-[2.22rem]">
            最近到底改了什么、成功没有、下一步看哪里，这里一屏说清。
          </h2>
          <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600">
            活动记录页现在更像一个运维时间流：左边看动作与任务，右边留给总结和判断。你不需要翻日志才能知道最近谁改了模型、谁重建了 Gateway、哪个动作失败了。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">活动 {activity.length}</span>
            <span className="pill-badge">任务 {tasks.length}</span>
            <span className="pill-badge">失败 {failedTasks}</span>
          </div>
        </div>

        <div className="surface-panel p-5 md:p-6">
          <div className="page-eyebrow">Summary</div>
          <div className="mt-4 space-y-3">
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">最近活动</div>
              <div className="mt-2 text-[1.5rem] font-semibold tracking-tight text-slate-900">{activity.length}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="surface-soft px-4 py-4">
                <div className="text-[13px] font-medium text-slate-500">成功 / 已记录</div>
                <div className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">{successCount}</div>
              </div>
              <div className="surface-soft px-4 py-4">
                <div className="text-[13px] font-medium text-slate-500">运行中任务</div>
                <div className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">{runningTasks}</div>
              </div>
            </div>
            <div className="console-note">
              如果你刚在 `18889` 改了模型、Provider 或飞书绑定，这里会比 Control UI 更快看出“是否已经落盘”和“是否还差一次 Gateway 重载”。
            </div>
          </div>
        </div>
      </section>

      <section className="console-stat-grid">
        <StatusCard title="最近活动" value={String(activity.length)} hint="已记录的后台动作与系统事件" tone={activity.length > 0 ? 'good' : 'default'} />
        <StatusCard title="最近任务" value={String(tasks.length)} hint="任务流里仍可追踪日志与状态" />
        <StatusCard title="失败任务" value={String(failedTasks)} hint="建议优先进入服务控制或相关页排查" tone={failedTasks > 0 ? 'warn' : 'default'} />
        <StatusCard title="运行中" value={String(runningTasks)} hint="当前仍在执行的后台任务数" tone={runningTasks > 0 ? 'good' : 'default'} />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px] 2xl:items-start">
        <div className="surface-panel p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">活动时间流</h2>
            <span className="pill-badge">Activity</span>
          </div>
          <div className="mt-4 space-y-3">
            {activity.length ? activity.map((item) => (
              <div key={item.id} className="list-row">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.action}</div>
                    <div className="mt-1 text-xs tracking-wide text-slate-400">{formatDate(item.createdAt)}</div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>{item.status}</span>
                </div>
                <div className="mt-2 text-[13px] leading-6 text-slate-600">{item.summary || '暂无摘要'}</div>
                {(item.targetType || item.targetId) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.targetType ? <span className="pill-badge">目标类型：{item.targetType}</span> : null}
                    {item.targetId ? <span className="pill-badge">目标：{item.targetId}</span> : null}
                  </div>
                ) : null}
              </div>
            )) : <div className="surface-soft px-5 py-8 text-center text-sm text-slate-500">暂无活动记录</div>}
          </div>
        </div>

        <div className="surface-panel p-5 md:p-6 2xl:sticky 2xl:top-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title">最近任务</h2>
            <span className="pill-badge">Tasks</span>
          </div>
          <div className="mt-4 space-y-3">
            {tasks.length ? tasks.map((task) => (
              <div key={task.id} className="surface-soft px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{task.title}</div>
                    <div className="mt-1 text-xs tracking-wide text-slate-400">{formatDate(task.createdAt)}</div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(task.status)}`}>{task.status}</span>
                </div>
                <div className="mt-2 text-[13px] leading-6 text-slate-600">{task.summary || '暂无摘要'}</div>
              </div>
            )) : <div className="surface-soft px-5 py-8 text-center text-sm text-slate-500">暂无任务记录</div>}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

import Link from 'next/link';
import type { PlatformClawSwarmServiceStatus } from '@/lib/server/platform-clawswarm';

const ITEMS = [
  { href: '/chat/messages', label: '消息中心', subtitle: 'Messages' },
  { href: '/chat/openclaws', label: '协作实例', subtitle: 'OpenClaws' },
  { href: '/chat/tasks', label: '任务中心', subtitle: 'Tasks' },
  { href: '/chat/settings', label: '协作设置', subtitle: 'Settings' },
];

function toneForHealth(status: PlatformClawSwarmServiceStatus) {
  if (!status.enabled) return 'border-slate-200 bg-white text-slate-500';
  if (status.reachable) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status.status === 'running') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-white text-slate-500';
}

export function PlatformCollabNav({
  currentPath,
  service,
  memberCount,
}: {
  currentPath: string;
  service: PlatformClawSwarmServiceStatus;
  memberCount?: number;
}) {
  return (
    <section className="surface-panel px-5 py-4 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="page-eyebrow">ClawSwarm Workspace</div>
          <h2 className="mt-2 text-[1.42rem] font-semibold tracking-tight text-slate-900">协作中心</h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-slate-600">
            这里承接 ClawSwarm 的群智协作能力。phase1 先把服务状态、成员映射和四个工作区骨架接通，再逐步补齐完整交互。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`pill-badge ${toneForHealth(service)}`}>{service.reachable ? '协作底座已连通' : service.enabled ? '等待联通' : '已关闭'}</span>
          <span className="pill-badge">成员 {memberCount ?? 0}</span>
          <span className="pill-badge">运行态 {service.status}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-4">
        {ITEMS.map((item) => {
          const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'rounded-[18px] border px-4 py-3 transition',
                active
                  ? 'border-sky-200 bg-sky-50 text-sky-700 shadow-[0_12px_28px_-24px_rgba(14,116,144,0.22)]'
                  : 'border-slate-200 bg-white/88 text-slate-600 hover:border-slate-300 hover:text-slate-900',
              ].join(' ')}
            >
              <div className="text-sm font-semibold">{item.label}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">{item.subtitle}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

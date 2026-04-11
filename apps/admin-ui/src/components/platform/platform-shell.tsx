import Link from 'next/link';
import type { PlatformUserRecord } from '@/lib/server/platform-repo';
import { platformLogoutAction } from '@/lib/server/platform-actions';

const NAV_ITEMS = [
  { href: '/home', label: '我的空间', subtitle: 'Home' },
  { href: '/lobsters', label: '我的龙虾', subtitle: 'Lobsters' },
  { href: '/chat', label: '协作中心', subtitle: 'Collab' },
  { href: '/models', label: '我的模型', subtitle: 'Models' },
];

export function PlatformShell({
  currentPath,
  title,
  description,
  user,
  children,
}: {
  currentPath: string;
  title: string;
  description?: string;
  user: PlatformUserRecord;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-4 px-3 py-4 lg:grid-cols-[236px_minmax(0,1fr)] xl:px-4">
        <aside className="surface-panel flex h-fit flex-col gap-4 px-4 py-4">
          <div>
            <div className="page-eyebrow">OpenClaw Workspace</div>
            <div className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">我的工作台</div>
            <div className="mt-2 text-[13px] leading-6 text-slate-600">
              这里只展示你的账号、龙虾、模型与绑定关系。平台底层运维和宿主机配置由管理员独立维护。
            </div>
          </div>

          <div className="surface-soft px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              当前账号
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{user.displayName}</div>
            <div className="mt-1 text-xs text-slate-500">{user.email}</div>
            <div className="mt-2 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
              个人工作区
            </div>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'flex items-center justify-between rounded-[18px] px-3 py-3 transition-colors',
                    active
                      ? 'bg-sky-50 text-sky-700 shadow-sm ring-1 ring-sky-100'
                      : 'text-slate-600 hover:bg-white/80 hover:text-slate-900',
                  ].join(' ')}
                >
                  <span>
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] uppercase tracking-[0.22em] text-slate-400">{item.subtitle}</span>
                  </span>
                  {active ? <span className="pill-badge border-sky-100 bg-white text-sky-700">当前</span> : null}
                </Link>
              );
            })}
          </nav>

          <div className="surface-soft px-3 py-3 text-[12px] leading-6 text-slate-500">
            你的工作台不会显示平台运维入口，也不会暴露宿主机、飞书告警、Gateway 与系统底座配置。
          </div>

          <div className="mt-auto space-y-2 pt-2">
            <form action={platformLogoutAction}>
              <button type="submit" className="btn-primary w-full justify-center">退出登录</button>
            </form>
          </div>
        </aside>

        <div className="min-w-0 space-y-4 pb-10">
          <header className="surface-panel px-5 py-4 md:px-6 md:py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="page-eyebrow">My Lobster Workspace</span>
                  <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">个人工作区</span>
                  <span className="pill-badge">仅管理我的龙虾与模型</span>
                </div>
                <h1 className="mt-2 text-[1.9rem] font-semibold tracking-tight text-slate-900 md:text-[2.14rem]">{title}</h1>
                {description ? <p className="mt-2 max-w-4xl text-[14px] leading-6 text-slate-600">{description}</p> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="pill-badge">我的账号</span>
                <span className="pill-badge">我的数据</span>
              </div>
            </div>
          </header>
          <main className="space-y-4">{children}</main>
        </div>
      </div>
    </div>
  );
}

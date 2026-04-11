import Link from 'next/link';
import { adminNavGroups } from '@/lib/navigation';

function isCurrent(currentPath: string, href: string) {
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function Sidebar({ currentPath }: { currentPath: string }) {
  return (
    <aside className="sticky top-4 flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[26px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.95)_100%)] px-3 py-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)] backdrop-blur-xl">
      <div className="mb-5 px-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-sky-100 bg-[linear-gradient(135deg,#53a5ff_0%,#237cff_62%,#5e7bff_100%)] text-sm font-semibold tracking-[0.22em] text-white shadow-[0_12px_24px_rgba(43,127,255,0.18)]">
            OC
          </div>
          <div>
            <div className="page-eyebrow">OpenClaw Console</div>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">运维后台</h1>
          </div>
        </div>
        <p className="mt-3 text-[12px] leading-5 text-slate-500">统一服务状态、模型路由、Agent 纳管和飞书告警的轻量控制台。</p>
      </div>

      <nav className="flex-1 space-y-5 overflow-auto pr-1">
        {adminNavGroups.map((group) => (
          <section key={group.group} aria-label={group.group}>
            <h2 className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400">{group.group}</h2>
            <div className="space-y-1.5">
              {group.items.map((item) => {
                const active = isCurrent(currentPath, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'group block rounded-[18px] border px-3 py-2.5 transition-all duration-200',
                      active
                        ? 'border-sky-200 bg-[linear-gradient(180deg,rgba(247,251,255,0.98)_0%,rgba(239,246,255,0.95)_100%)] text-slate-900 shadow-[0_10px_24px_rgba(59,130,246,0.1)]'
                        : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-white/90 hover:text-slate-900 hover:shadow-[0_8px_18px_rgba(15,23,42,0.035)]'
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium leading-5">{item.label}</div>
                        <div className={`mt-0.5 truncate text-[11px] leading-5 ${active ? 'text-sky-700/70' : 'text-slate-400 group-hover:text-slate-500'}`}>
                          {item.subtitle}
                        </div>
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-sky-500' : 'bg-slate-200 group-hover:bg-slate-300'}`} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50/90 px-3 py-3 text-[11px] leading-5 text-slate-500">
        当前页面风格已统一到更亮、更紧凑的 OpenClaw 控制台语言，重点收敛在“可操作”和“可排障”。
      </div>
    </aside>
  );
}

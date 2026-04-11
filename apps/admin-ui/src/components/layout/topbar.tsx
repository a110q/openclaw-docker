export function Topbar({
  title,
  description,
  badge,
  sectionLabel
}: {
  title: string;
  description?: string;
  badge?: string;
  sectionLabel?: string;
}) {
  return (
    <header className="surface-panel px-5 py-4 md:px-6 md:py-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="page-eyebrow">OpenClaw Console</span>
            {sectionLabel ? <span className="pill-badge">{sectionLabel}</span> : null}
            {badge ? <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">{badge}</span> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
            <h1 className="text-[1.85rem] font-semibold leading-none tracking-tight text-slate-900 md:text-[2.08rem]">{title}</h1>
            <span className="text-sm font-medium text-slate-400">轻量运维台</span>
          </div>
          {description ? <p className="mt-2 max-w-4xl text-[14px] leading-6 text-slate-600">{description}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <span className="pill-badge">Docker 部署</span>
          <span className="pill-badge">OpenClaw 风格</span>
          <form action="/api/admin/v1/session/logout" method="post">
            <button type="submit" className="btn-secondary">退出登录</button>
          </form>
        </div>
      </div>
    </header>
  );
}

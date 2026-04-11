export function StatusCard({
  title,
  value,
  hint,
  tone = 'default'
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  const toneClass = {
    default: 'border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,250,252,0.94)_100%)]',
    good: 'border-emerald-200/90 bg-[linear-gradient(180deg,rgba(240,253,244,0.98)_0%,rgba(255,255,255,0.96)_100%)]',
    warn: 'border-amber-200/90 bg-[linear-gradient(180deg,rgba(255,251,235,0.98)_0%,rgba(255,255,255,0.96)_100%)]'
  }[tone];

  const accentClass = {
    default: 'from-slate-400 to-slate-200',
    good: 'from-emerald-500 to-emerald-200',
    warn: 'from-amber-500 to-amber-200'
  }[tone];

  const dotClass = {
    default: 'bg-slate-300',
    good: 'bg-emerald-500',
    warn: 'bg-amber-500'
  }[tone];

  return (
    <section className={`metric-card h-full ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</div>
          <div className="mt-3 break-words text-[1.42rem] font-semibold leading-tight tracking-tight text-slate-900">{value}</div>
        </div>
        <span className={`status-dot ${dotClass}`} />
      </div>
      <div className={`mt-4 h-[3px] w-12 rounded-full bg-gradient-to-r ${accentClass}`} />
      {hint ? <div className="mt-3 text-[13px] leading-6 text-slate-500">{hint}</div> : null}
    </section>
  );
}

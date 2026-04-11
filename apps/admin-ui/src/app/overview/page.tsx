import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { StatusCard } from '@/components/cards/status-card';
import { readSystemStatus } from '@/lib/server/system-status';
import { readNetworkPolicyStatus } from '@/lib/server/network-policy';
import { readOpenClawConfigDiagnostics } from '@/lib/server/config-diagnostics';

export const dynamic = 'force-dynamic';

function healthTone(health: string) {
  if (health === 'healthy') return 'good' as const;
  if (health === 'unhealthy') return 'warn' as const;
  return 'default' as const;
}

function runtimeLabel(value: string) {
  if (value === 'running') return '运行中';
  if (value === 'stopped') return '已停止';
  if (value === 'starting') return '启动中';
  if (value === 'healthy') return '健康';
  if (value === 'unhealthy') return '异常';
  return '未知';
}

function formatCheckedAt(value?: string) {
  if (!value) return '尚未探测';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function networkTone(decision: string) {
  if (decision === 'proxy') return 'good' as const;
  if (decision === 'direct') return 'default' as const;
  return 'warn' as const;
}

function networkNoticeTone(decision: string) {
  if (decision === 'proxy') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (decision === 'direct') return 'border-slate-200 bg-slate-50 text-slate-600';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export default async function OverviewPage() {
  const [status, networkPolicy, configDiagnostics] = await Promise.all([
    readSystemStatus(),
    readNetworkPolicyStatus(),
    readOpenClawConfigDiagnostics()
  ]);

  const stats = [
    {
      title: 'Gateway',
      value: runtimeLabel(status.gateway.status),
      hint: status.gateway.ports.join(' / ') || '未暴露端口',
      tone: healthTone(status.gateway.health)
    },
    {
      title: '默认模型',
      value: status.summary.defaultModel || '未配置',
      hint: status.summary.defaultProvider || '未识别 Provider',
      tone: 'default' as const
    },
    {
      title: '告警通道',
      value: `${status.summary.enabledAlertChannels} 条`,
      hint: '已启用飞书 Webhook',
      tone: status.summary.enabledAlertChannels > 0 ? ('good' as const) : ('default' as const)
    },
    {
      title: '网络决策',
      value: networkPolicy.decisionLabel,
      hint: formatCheckedAt(networkPolicy.lastCheckedAt),
      tone: networkTone(networkPolicy.decision)
    }
  ];

  const focusRows = [
    {
      label: '配置自检',
      value: configDiagnostics.issueCount > 0 ? `${configDiagnostics.issueCount} 项风险` : '当前配置正常',
      description:
        configDiagnostics.issueCount > 0
          ? '建议优先进入服务控制页处理风险，再决定重启还是重建。'
          : '当前未发现会阻断 Gateway 启动的配置问题。'
    },
    {
      label: '后台状态',
      value: `Admin UI · ${runtimeLabel(status.adminUi.status)}`,
      description: `版本 ${status.adminUi.version} · 当前部署模式 ${status.deploymentMode}`
    },
    {
      label: '代理策略',
      value: networkPolicy.decisionLabel,
      description: networkPolicy.reason
    }
  ];

  const quickLinks = [
    { href: '/services', title: '服务控制', description: '启停 Gateway、看日志和应用配置修复。', badge: 'Runtime' },
    { href: '/models/bindings', title: '模型绑定', description: '检查平台默认模型和 Agent 级路由优先级。', badge: 'Routing' },
    { href: '/alerts/feishu', title: '飞书告警', description: '查看扫描、绑定和最近活动消息。', badge: 'Alerts' }
  ];

  return (
    <AppShell currentPath="/overview" title="系统总览" description="把 Gateway、模型、网络决策与告警状态压进一张更紧凑的控制桌面。" badge="Live">
      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.28fr)_360px]">
        <div className="console-hero">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
            <div className="min-w-0">
              <div className="page-eyebrow">Operations Overview</div>
              <h2 className="mt-3 max-w-4xl text-[1.95rem] font-semibold leading-tight tracking-tight text-slate-900 md:text-[2.3rem]">
                把运行态、网络策略和模型路由，收拢到一张真正能操作的总控桌面。
              </h2>
              <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600">
                当前总览直接读取 Docker Compose 运行态、代理策略快照和配置自检结果。重点不是堆信息，而是让你打开后台第一眼就知道：服务是否可用、模型是否落对、代理是否真的生效。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">Gateway：{runtimeLabel(status.gateway.status)}</span>
                <span className="pill-badge">Health：{runtimeLabel(status.gateway.health)}</span>
                <span className="pill-badge">端口：{status.gateway.ports.join(' / ') || '未暴露'}</span>
              </div>
              <div className={`console-note mt-5 border ${networkNoticeTone(networkPolicy.decision)}`}>
                当前网络策略：{networkPolicy.reason}。配置代理：{networkPolicy.configuredProxy || '未配置'}；实际代理：
                {networkPolicy.effectiveProxy || '直连'}。
              </div>
            </div>

            <div className="grid gap-3">
              {focusRows.map((item) => (
                <div key={item.label} className="surface-soft px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{item.label}</div>
                  <div className="mt-2 text-[1.08rem] font-semibold tracking-tight text-slate-900">{item.value}</div>
                  <div className="mt-2 text-[13px] leading-6 text-slate-500">{item.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="surface-panel p-5 md:p-6">
          <div className="page-eyebrow">Today Focus</div>
          <h2 className="mt-3 text-[1.35rem] font-semibold tracking-tight text-slate-900">先看这三块</h2>
          <div className="mt-4 space-y-3">
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">Gateway</div>
              <div className="mt-2 text-[1.45rem] font-semibold tracking-tight text-slate-900">{runtimeLabel(status.gateway.status)}</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">健康度 {runtimeLabel(status.gateway.health)}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">默认模型</div>
              <div className="mt-2 break-words text-[1.05rem] font-semibold tracking-tight text-slate-900">{status.summary.defaultModel || '未配置'}</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">Provider {status.summary.defaultProvider || '未识别'}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">最近探测</div>
              <div className="mt-2 text-[1.2rem] font-semibold tracking-tight text-slate-900">{formatCheckedAt(networkPolicy.lastCheckedAt)}</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">{networkPolicy.decisionLabel}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="console-stat-grid">
        {stats.map((item) => (
          <StatusCard key={item.title} title={item.title} value={item.value} hint={item.hint} tone={item.tone} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_380px] xl:items-start">
        <div className="surface-panel p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="section-title">重点诊断</h2>
              <p className="mt-1 muted-copy">把最常见的启动、代理和配置问题压进一个更容易扫读的面板。</p>
            </div>
            <span className="pill-badge">Diagnostics</span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="metric-card">
              <div className="text-[13px] font-medium text-slate-500">Gateway 端口</div>
              <div className="mt-2 text-[1.1rem] font-semibold tracking-tight text-slate-900">{status.gateway.ports.join(' / ') || '未暴露'}</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">先确认服务状态，再确认端口映射。</div>
            </div>
            <div className="metric-card">
              <div className="text-[13px] font-medium text-slate-500">配置风险</div>
              <div className="mt-2 text-[1.1rem] font-semibold tracking-tight text-slate-900">
                {configDiagnostics.issueCount > 0 ? `${configDiagnostics.issueCount} 项` : '无阻断项'}
              </div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">自动修复 {configDiagnostics.autoFixableCount} 项</div>
            </div>
            <div className="metric-card">
              <div className="text-[13px] font-medium text-slate-500">代理生效</div>
              <div className="mt-2 break-all text-[1.02rem] font-semibold tracking-tight text-slate-900">{networkPolicy.effectiveProxy || '直连'}</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">{networkPolicy.reason}</div>
            </div>
          </div>
        </div>

        <div className="surface-panel p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">快捷入口</h2>
              <p className="mt-1 muted-copy">从总览直接进入最常用的排障与配置页面。</p>
            </div>
            <span className="pill-badge">Shortcuts</span>
          </div>
          <div className="mt-4 space-y-3">
            {quickLinks.map((item) => (
              <Link key={item.href} href={item.href} className="surface-soft block px-4 py-4 hover:border-sky-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-[13px] leading-6 text-slate-500">{item.description}</div>
                  </div>
                  <span className="pill-badge">{item.badge}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

import { AppShell } from '@/components/layout/app-shell';
import { StatusCard } from '@/components/cards/status-card';
import { ServiceControls } from '@/components/system/service-controls';
import { ConfigDiagnosticsPanel } from '@/components/system/config-diagnostics-panel';
import { SandboxRuntimePanel } from '@/components/system/sandbox-runtime-panel';
import { readComposeLogs } from '@/lib/server/compose';
import { readNetworkPolicyStatus } from '@/lib/server/network-policy';
import { readOpenClawConfigDiagnostics } from '@/lib/server/config-diagnostics';
import { readSystemStatus } from '@/lib/server/system-status';
import { readSandboxContainerSnapshot } from '@/lib/server/sandbox-resources';

export const dynamic = 'force-dynamic';

function runtimeLabel(value: string) {
  if (value === 'running') return '运行中';
  if (value === 'stopped') return '已停止';
  if (value === 'starting') return '启动中';
  if (value === 'healthy') return '健康';
  if (value === 'unhealthy') return '异常';
  return '未知';
}

function runtimeTone(value: string) {
  if (value === 'running' || value === 'healthy') return 'good' as const;
  if (value === 'stopped' || value === 'unhealthy') return 'warn' as const;
  return 'default' as const;
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

function networkDecisionTone(decision: string) {
  if (decision === 'proxy') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (decision === 'proxy_only_failed') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export default async function ServicesPage() {
  const [status, logs, networkPolicy, configDiagnostics, sandboxContainers] = await Promise.all([
    readSystemStatus(),
    readComposeLogs('openclaw-gateway', 80).catch((error) => `读取日志失败：${error instanceof Error ? error.message : 'unknown error'}`),
    readNetworkPolicyStatus(),
    readOpenClawConfigDiagnostics(),
    readSandboxContainerSnapshot().catch(() => []),
  ]);

  const gatewayPorts = status.gateway.ports.join(' / ') || '未暴露端口';
  const gatewayContainer = status.gateway.containerName || 'gateway container';
  const playbook = [
    {
      title: '改了 API Key / Base URL / 代理变量',
      description: '优先执行“强制重建”，确保容器环境变量、镜像和挂载配置被重新载入。'
    },
    {
      title: '只是更新 live 配置或轻微异常',
      description: '先用“平滑重启”，恢复成本更低，观察窗口也更短。'
    },
    {
      title: '排查 network connection error',
      description: '先看当前网络策略是否已自动回退直连，再去日志里追具体报错。'
    }
  ];

  return (
    <AppShell currentPath="/services" title="服务控制" description="把启停、网络排查、配置修复与日志集中到一张更紧凑的 Gateway 工作台。" badge="Gateway Runtime">
      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <div className="console-hero">
          <div className="page-eyebrow">Gateway Desk</div>
          <h2 className="mt-3 text-[1.95rem] font-semibold leading-tight tracking-tight text-slate-900 md:text-[2.28rem]">
            服务启停、网络决策和现场日志，收拢到同一张操作台里。
          </h2>
          <p className="mt-3 max-w-3xl text-[14px] leading-6 text-slate-600">
            这里优先给出当前运行态、实际网络决策和可执行动作。你改了 API Key、Base URL 或代理变量之后，可以更快判断该重启还是强制重建，而不是在多个页面来回跳。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">服务：openclaw-gateway</span>
            <span className="pill-badge">容器：{gatewayContainer}</span>
            <span className="pill-badge">端口：{gatewayPorts}</span>
          </div>
          <div className={`console-note mt-5 border ${networkDecisionTone(networkPolicy.decision)}`}>
            当前网络策略：{networkPolicy.reason}。配置代理：{networkPolicy.configuredProxy || '未配置'}；生效代理：{networkPolicy.effectiveProxy || '当前为空，说明走直连'}。
          </div>
        </div>

        <div className="surface-panel p-5 md:p-6">
          <div className="page-eyebrow">Summary</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">Gateway 状态</div>
              <div className="mt-2 text-[1.5rem] font-semibold tracking-tight text-slate-900">{runtimeLabel(status.gateway.status)}</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">健康度 {runtimeLabel(status.gateway.health)}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">探测时间</div>
              <div className="mt-2 text-[1.1rem] font-semibold tracking-tight text-slate-900">{formatCheckedAt(networkPolicy.lastCheckedAt)}</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">{networkPolicy.decisionLabel}</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">自动修复</div>
              <div className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">{configDiagnostics.autoFixableCount}</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">配置风险 {configDiagnostics.issueCount} 项</div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[13px] font-medium text-slate-500">Sandbox</div>
              <div className="mt-2 text-[1.1rem] font-semibold tracking-tight text-slate-900">{networkPolicy.sandboxUsesProxy ? '走代理' : '走直连'}</div>
              <div className="mt-1 text-[13px] leading-6 text-slate-500">extraHosts {networkPolicy.sandboxExtraHostCount} 条</div>
            </div>
          </div>
        </div>
      </section>

      <section className="console-stat-grid">
        <StatusCard title="Gateway 状态" value={runtimeLabel(status.gateway.status)} hint={gatewayContainer} tone={runtimeTone(status.gateway.status)} />
        <StatusCard title="健康度" value={runtimeLabel(status.gateway.health)} hint={gatewayPorts} tone={runtimeTone(status.gateway.health)} />
        <StatusCard title="网络决策" value={networkPolicy.decisionLabel} hint={networkPolicy.effectiveProxy || '当前直连'} tone={networkPolicy.decision === 'proxy' ? 'good' : networkPolicy.decision === 'proxy_only_failed' ? 'warn' : 'default'} />
        <StatusCard title="配置风险" value={configDiagnostics.issueCount > 0 ? `${configDiagnostics.issueCount} 项` : '配置正常'} hint={`自动修复 ${configDiagnostics.autoFixableCount} 项`} tone={configDiagnostics.issueCount > 0 ? 'warn' : 'good'} />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
        <div className="space-y-4 2xl:sticky 2xl:top-4">
          <div className="surface-panel p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="section-title">服务动作</h2>
                <p className="mt-1 muted-copy">把动作按影响范围排开，减少误触和反复确认。</p>
              </div>
              <span className="pill-badge">Actions</span>
            </div>
            <div className="mt-4">
              <ServiceControls />
            </div>
          </div>

          <div className="surface-panel p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">操作手册</h2>
                <p className="mt-1 muted-copy">高频场景直接给结论，减少判断成本。</p>
              </div>
              <span className="pill-badge">Playbook</span>
            </div>
            <div className="mt-4 space-y-3">
              {playbook.map((item) => (
                <div key={item.title} className="surface-soft px-4 py-4">
                  <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                  <div className="mt-2 text-[13px] leading-6 text-slate-500">{item.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-panel p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="section-title">网络细节</h2>
                <p className="mt-1 muted-copy">把代理决策、Sandbox 继承和探测状态收进一个排障面板。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="pill-badge">探测时间 {formatCheckedAt(networkPolicy.lastCheckedAt)}</span>
                <span className="pill-badge">{networkPolicy.sandboxNetwork}</span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="metric-card">
                <div className="text-[13px] font-medium text-slate-500">配置模式</div>
                <div className="mt-2 text-[1.15rem] font-semibold tracking-tight text-slate-900">{networkPolicy.modeLabel}</div>
                <div className="mt-1 text-[13px] leading-6 text-slate-500">{networkPolicy.rawReason || '策略未记录'}</div>
              </div>
              <div className="metric-card">
                <div className="text-[13px] font-medium text-slate-500">当前生效</div>
                <div className="mt-2 text-[1.15rem] font-semibold tracking-tight text-slate-900">{networkPolicy.decisionLabel}</div>
                <div className="mt-1 break-all text-[13px] leading-6 text-slate-500">{networkPolicy.effectiveProxy || '直连'}</div>
              </div>
              <div className="metric-card">
                <div className="text-[13px] font-medium text-slate-500">Sandbox 继承</div>
                <div className="mt-2 text-[1.15rem] font-semibold tracking-tight text-slate-900">{networkPolicy.sandboxUsesProxy ? '走代理' : '走直连'}</div>
                <div className="mt-1 text-[13px] leading-6 text-slate-500">extraHosts {networkPolicy.sandboxExtraHostCount} 条</div>
              </div>
              <div className="metric-card">
                <div className="text-[13px] font-medium text-slate-500">探测地址</div>
                <div className="mt-2 break-all text-[1rem] font-semibold tracking-tight text-slate-900">{networkPolicy.probeUrl || '未探测'}</div>
                <div className="mt-1 text-[13px] leading-6 text-slate-500">配置代理 {networkPolicy.configuredProxy || '未配置'}</div>
              </div>
            </div>

            <div className={`mt-4 rounded-[20px] border px-4 py-4 text-sm leading-6 ${networkDecisionTone(networkPolicy.decision)}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-slate-900">{networkPolicy.reason}</div>
                <span className="pill-badge border-white/70 bg-white/70 text-inherit">{networkPolicy.decisionLabel}</span>
              </div>
              <div className="mt-2">配置代理：{networkPolicy.configuredProxy || '未配置'}；生效代理：{networkPolicy.effectiveProxy || '当前为空，说明走直连'}。</div>
            </div>

            {networkPolicy.probeError ? <div className="notice-error mt-4">最近探测失败：{networkPolicy.probeError}</div> : null}
          </div>

          <ConfigDiagnosticsPanel diagnostics={configDiagnostics} />
        </div>
      </section>

      <SandboxRuntimePanel initialContainers={sandboxContainers} />

      <section className="surface-panel p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title">最近日志</h2>
            <p className="mt-1 muted-copy">完整保留横向空间，方便直接看上下文、搜索关键字和复制排障片段。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="pill-badge">tail=80</span>
            <span className="pill-badge">网络：{networkPolicy.decisionLabel}</span>
          </div>
        </div>

        <pre className="mt-4 max-h-[680px] overflow-auto whitespace-pre-wrap break-words rounded-[22px] border border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 text-[12px] leading-6 text-slate-700 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
          {logs || '暂无日志'}
        </pre>
      </section>
    </AppShell>
  );
}

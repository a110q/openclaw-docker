'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ConfigAutoFixResult, ConfigDiagnostics } from '@/lib/types/admin';

function panelTone(summary: ConfigDiagnostics['summary']) {
  if (summary === 'healthy') return 'border-emerald-200/90 bg-[linear-gradient(180deg,#f5fff8_0%,#ffffff_100%)]';
  if (summary === 'warning') return 'border-amber-200/90 bg-[linear-gradient(180deg,#fffdf7_0%,#ffffff_100%)]';
  return 'border-rose-200/90 bg-[linear-gradient(180deg,#fff8f8_0%,#ffffff_100%)]';
}

function severityTone(severity: 'warning' | 'error') {
  if (severity === 'error') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export function ConfigDiagnosticsPanel({ diagnostics }: { diagnostics: ConfigDiagnostics }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function applyFixes() {
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/admin/v1/system/config-diagnostics/apply', { method: 'POST' });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: ConfigAutoFixResult; error?: string };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || '应用推荐修复失败');
      }

      setMessage(payload.data?.summary || '推荐修复已应用');
      router.refresh();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : '应用推荐修复失败');
    } finally {
      setLoading(false);
    }
  }

  const healthy = diagnostics.summary === 'healthy';

  return (
    <section className={`surface-panel border p-5 md:p-6 ${panelTone(diagnostics.summary)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="page-eyebrow">Config Diagnostics</div>
          <h2 className="mt-2 text-[1.38rem] font-semibold tracking-tight text-slate-900 md:text-[1.62rem]">先把会绊倒 Gateway 的配置，提前拎出来。</h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-slate-600">
            这里会扫描 live `openclaw.json` 里最容易导致启动失败或升级兼容问题的配置项，比如旧版 `p2p` 绑定或不合法的枚举值。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="pill-badge">{healthy ? '配置正常' : `${diagnostics.issueCount} 项风险`}</span>
          <span className="pill-badge">自动修复 {diagnostics.autoFixableCount}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="surface-soft px-4 py-4">
          <div className="text-[12px] font-medium text-slate-500">当前健康度</div>
          <div className="mt-2 text-[1.2rem] font-semibold tracking-tight text-slate-900">{healthy ? '可直接运行' : '建议先处理'}</div>
          <div className="mt-1 text-[13px] leading-6 text-slate-500">以 Gateway 启动和兼容性为优先判断标准。</div>
        </div>
        <div className="surface-soft px-4 py-4">
          <div className="text-[12px] font-medium text-slate-500">风险条数</div>
          <div className="mt-2 text-[1.2rem] font-semibold tracking-tight text-slate-900">{diagnostics.issueCount}</div>
          <div className="mt-1 text-[13px] leading-6 text-slate-500">越多越建议先修配置，再执行动作。</div>
        </div>
        <div className="surface-soft px-4 py-4">
          <div className="text-[12px] font-medium text-slate-500">自动修复</div>
          <div className="mt-2 text-[1.2rem] font-semibold tracking-tight text-slate-900">{diagnostics.autoFixableCount}</div>
          <div className="mt-1 text-[13px] leading-6 text-slate-500">可直接在这里应用，不必手改文件。</div>
        </div>
      </div>

      {healthy ? (
        <div className="surface-soft mt-4 px-4 py-4">
          <div className="text-base font-semibold tracking-tight text-slate-900">当前未发现会阻断 Gateway 启动的配置问题。</div>
          <div className="mt-1 text-[13px] leading-6 text-slate-600">如果你稍后又手动改了 `openclaw.json`，回到这里就能立刻看到新的诊断结果。</div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {diagnostics.issues.map((issue) => (
            <div key={issue.id} className="list-row">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{issue.message}</div>
                <div className="flex flex-wrap gap-2">
                  <span className={`pill-badge ${severityTone(issue.severity)}`}>{issue.severity === 'error' ? '错误' : '警告'}</span>
                  <span className="pill-badge">{issue.scope}</span>
                </div>
              </div>
              <div className="mt-3 grid gap-x-4 gap-y-2 text-[13px] leading-6 text-slate-600 md:grid-cols-2">
                <div>
                  位置：<span className="font-mono text-[12px] text-slate-700">{issue.path}</span>
                </div>
                {issue.currentValue ? (
                  <div>
                    当前值：<span className="font-mono text-[12px] text-slate-700">{issue.currentValue}</span>
                  </div>
                ) : null}
                {issue.allowedValues?.length ? (
                  <div>
                    允许值：<span className="font-mono text-[12px] text-slate-700">{issue.allowedValues.join(' | ')}</span>
                  </div>
                ) : null}
                {issue.suggestedValue ? (
                  <div>
                    推荐修复：<span className="font-mono text-[12px] text-slate-700">{issue.suggestedValue}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-[13px] leading-6 text-slate-500">
          {diagnostics.autoFixableCount > 0
            ? '应用修复后建议再执行一次平滑重启或强制重建，让 Gateway 重新载入配置。'
            : '当前没有推荐自动修复时，说明问题仍需要你手动判断配置含义。'}
        </div>
        {diagnostics.autoFixableCount > 0 ? (
          <button type="button" onClick={applyFixes} disabled={loading} className="btn-primary min-w-[188px]">
            {loading ? '应用推荐修复中…' : `应用推荐修复（${diagnostics.autoFixableCount}）`}
          </button>
        ) : null}
      </div>

      {message ? <div className="notice-success mt-4">{message}</div> : null}
      {error ? <div className="notice-error mt-4">{error}</div> : null}
    </section>
  );
}

import type { HostCapabilityExecution, HostCapabilityPreview } from '@/lib/types/host-capabilities';

export function CapabilityResultView({
  preview,
  execution
}: {
  preview?: HostCapabilityPreview | null;
  execution?: HostCapabilityExecution | null;
}) {
  return (
    <div className="space-y-4">
      <div className="surface-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">预览结果</h3>
          {preview ? <span className="pill-badge">{preview.impact}</span> : null}
        </div>
        {preview ? (
          <>
            <p className="mt-3 text-sm leading-7 text-slate-600">{preview.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="pill-badge">风险：{preview.riskLevel}</span>
              <span className="pill-badge">确认：{preview.requiresConfirmation ? '需要' : '无需'}</span>
            </div>
            {preview.changes.length ? (
              <div className="mt-4 space-y-2">
                {preview.changes.map((change) => (
                  <div key={`${change.source}:${change.field}`} className="surface-soft px-4 py-3 text-sm text-slate-600">
                    <span className="font-medium text-slate-900">{change.field}</span>
                    <span className="ml-2 text-slate-500">来源：{change.source}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">该能力为只读或无配置变更。</div>
            )}
          </>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">点击“预览变更”后在这里查看影响分析。</div>
        )}
      </div>

      <div className="surface-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">执行结果</h3>
          {execution ? <span className="pill-badge">{execution.status}</span> : null}
        </div>
        {execution ? (
          <>
            <p className="mt-3 text-sm leading-7 text-slate-600">{execution.summary}</p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-6 text-slate-600">
              <div>任务 ID：{execution.taskId}</div>
              <div className="mt-2">结果：</div>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-500">{JSON.stringify(execution.result, null, 2)}</pre>
            </div>
            {execution.logs.length ? (
              <pre className="mt-4 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-6 text-slate-500">{execution.logs.join('\n')}</pre>
            ) : null}
          </>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-3 text-sm text-slate-500">执行能力后，这里会显示任务编号、返回结果和运行日志。</div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type DiscoveryItem = {
  path: string;
  suggestedName: string;
  status: string;
  reason: string;
};

function statusTone(status: string) {
  if (status === 'discoverable') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'already-managed') return 'bg-slate-50 text-slate-600 border-slate-200';
  if (status === 'invalid' || status === 'ignored') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export function DiscoveryScanner() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DiscoveryItem[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const summary = useMemo(() => ({
    discoverable: items.filter((item) => item.status === 'discoverable').length,
    managed: items.filter((item) => item.status === 'already-managed').length,
    invalid: items.filter((item) => item.status === 'invalid' || item.status === 'ignored').length,
  }), [items]);

  async function scan() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/v1/agents/discovery/scan', { method: 'POST' });
      const payload = (await response.json()) as { data?: { items?: DiscoveryItem[] }; error?: string };
      if (!response.ok) throw new Error(payload.error || '扫描失败');
      setItems(payload.data?.items || []);
      setMessage(`扫描完成，发现 ${(payload.data?.items || []).length} 个目录`);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : '扫描失败');
    } finally {
      setLoading(false);
    }
  }

  async function importItems() {
    const importable = items.filter((item) => item.status === 'discoverable').map((item) => ({ path: item.path, suggestedName: item.suggestedName }));
    if (!importable.length) {
      setError('没有可导入的 Agent');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/v1/agents/discovery/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: importable })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; data?: Array<unknown> };
      if (!response.ok) throw new Error(payload.error || '导入失败');
      setMessage(`已导入 ${(payload.data || []).length} 个 Agent`);
      router.refresh();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : '导入失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="console-toolbar justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>结果 {items.length}</span>
          <span>•</span>
          <span>可导入 {summary.discoverable}</span>
          <span>•</span>
          <span>已纳管 {summary.managed}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={scan} disabled={loading} className="btn-primary">
            {loading ? '扫描中…' : '开始扫描'}
          </button>
          <button type="button" onClick={importItems} disabled={loading || !summary.discoverable} className="btn-secondary">
            导入可发现 Agent
          </button>
        </div>
      </div>
      {message ? <div className="notice-success">{message}</div> : null}
      {error ? <div className="notice-error">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="surface-soft px-4 py-4">
          <div className="text-[12px] font-medium text-slate-500">可导入</div>
          <div className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">{summary.discoverable}</div>
        </div>
        <div className="surface-soft px-4 py-4">
          <div className="text-[12px] font-medium text-slate-500">已纳管</div>
          <div className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">{summary.managed}</div>
        </div>
        <div className="surface-soft px-4 py-4">
          <div className="text-[12px] font-medium text-slate-500">无效 / 忽略</div>
          <div className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">{summary.invalid}</div>
        </div>
      </div>
      <div className="space-y-3">
        {items.length ? items.map((item) => (
          <div key={item.path} className="list-row">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900">{item.suggestedName}</div>
                <div className="mt-1 break-all text-xs leading-6 text-slate-400">{item.path}</div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>{item.status}</span>
            </div>
            <div className="mt-3 text-sm leading-7 text-slate-600">{item.reason}</div>
          </div>
        )) : <div className="surface-soft px-5 py-10 text-center text-sm text-slate-500">点击“开始扫描”后，这里会列出可纳管的 Agent 目录。</div>}
      </div>
    </div>
  );
}

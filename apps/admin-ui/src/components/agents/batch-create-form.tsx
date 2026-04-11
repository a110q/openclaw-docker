'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type ModelOption = { id: string; label: string };

function buildPreview(prefix: string, count: number, startIndex: number) {
  return Array.from({ length: Math.max(0, Math.min(count, 4)) }, (_, offset) => {
    const numeric = String(startIndex + offset).padStart(3, '0');
    return `${prefix || 'agent'}-${numeric}`;
  });
}

export function BatchCreateForm({ models }: { models: ModelOption[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    prefix: 'ops',
    count: 3,
    startIndex: 1,
    primaryModelId: models[0]?.id || '',
    imageModelId: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const previewNames = useMemo(() => buildPreview(form.prefix.trim(), form.count, form.startIndex), [form.prefix, form.count, form.startIndex]);
  const selectedModel = models.find((item) => item.id === form.primaryModelId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/v1/agents/batch-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; data?: Array<unknown> };
      if (!response.ok) throw new Error(payload.error || '批量创建失败');
      setMessage(`已创建 ${(payload.data || []).length} 个 Agent`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '批量创建失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]" onSubmit={submit}>
      <div className="space-y-4">
        <div className="surface-soft grid gap-4 px-4 py-4 md:grid-cols-2">
          <label className="block">
            <span className="field-label">前缀</span>
            <input value={form.prefix} onChange={(event) => setForm({ ...form, prefix: event.target.value })} className="field" />
          </label>
          <label className="block">
            <span className="field-label">数量</span>
            <input type="number" min={1} max={50} value={form.count} onChange={(event) => setForm({ ...form, count: Number(event.target.value) })} className="field" />
          </label>
          <label className="block">
            <span className="field-label">起始编号</span>
            <input type="number" min={1} value={form.startIndex} onChange={(event) => setForm({ ...form, startIndex: Number(event.target.value) })} className="field" />
          </label>
          <label className="block">
            <span className="field-label">主模型</span>
            <select value={form.primaryModelId} onChange={(event) => setForm({ ...form, primaryModelId: event.target.value })} className="field">
              {models.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="field-label">备注</span>
          <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-24 w-full field" placeholder="例如：开发环境 Agent / 运维轮值 Agent 组" />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? '创建中…' : '批量创建 Agent'}
          </button>
          <span className="pill-badge">会同时创建目录并写入配置</span>
        </div>

        {message ? <div className="notice-success">{message}</div> : null}
        {error ? <div className="notice-error">{error}</div> : null}
      </div>

      <div className="surface-soft px-4 py-4 xl:sticky xl:top-4 xl:self-start">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Create Preview</div>
        <div className="mt-3 text-base font-semibold text-slate-900">即将生成 {form.count} 个 Agent</div>
        <div className="mt-1 text-[13px] leading-6 text-slate-500">主模型：{selectedModel?.label || '未选择'}</div>
        <div className="mt-4 space-y-2">
          {previewNames.map((name) => (
            <div key={name} className="rounded-[16px] border border-slate-200 bg-white/90 px-3 py-3 text-sm font-medium text-slate-800">
              {name}
            </div>
          ))}
        </div>
        <div className="mt-4 text-[12px] leading-6 text-slate-500">如果数量超过 4，这里只预览前 4 个命名结果。</div>
      </div>
    </form>
  );
}

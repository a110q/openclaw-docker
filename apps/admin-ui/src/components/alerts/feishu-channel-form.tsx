'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export type FeishuChannelFormValues = {
  id: string;
  name: string;
  webhookUrl: string;
  secret: string;
  enabled: boolean;
  minLevel: 'info' | 'warning' | 'critical';
};

export const DEFAULT_FEISHU_CHANNEL_FORM: FeishuChannelFormValues = {
  id: '',
  name: '',
  webhookUrl: '',
  secret: '',
  enabled: true,
  minLevel: 'warning'
};

export function FeishuChannelForm({
  initialValue,
  mode = 'create',
  onSaved,
  onCancel
}: {
  initialValue?: FeishuChannelFormValues;
  mode?: 'create' | 'edit';
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const seed = useMemo(() => initialValue ?? DEFAULT_FEISHU_CHANNEL_FORM, [initialValue]);
  const [form, setForm] = useState<FeishuChannelFormValues>(seed);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(seed);
    setMessage('');
    setError('');
  }, [seed]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const isEdit = mode === 'edit';
      const response = await fetch(isEdit ? `/api/admin/v1/alerts/channels/${form.id}` : '/api/admin/v1/alerts/channels', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || '保存失败');
      setMessage(isEdit ? '飞书通道已更新' : '飞书通道已保存');
      if (!isEdit) {
        setForm(DEFAULT_FEISHU_CHANNEL_FORM);
      }
      onSaved?.();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="surface-soft px-4 py-4 text-sm leading-6 text-slate-600">
        {mode === 'edit'
          ? '当前为编辑模式：Secret 留空时沿用已有签名密钥，可仅更新名称、Webhook 或告警等级。'
          : '新增模式适合接入新的飞书机器人，保存后即可在通道列表里发送测试消息。'}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="field-label">通道 ID</span>
          <input value={form.id} disabled={mode === 'edit'} onChange={(event) => setForm({ ...form, id: event.target.value })} className="field disabled:cursor-not-allowed disabled:opacity-70" placeholder="feishu-main" />
        </label>
        <label className="block">
          <span className="field-label">通道名称</span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="field" placeholder="生产告警" />
        </label>
      </div>

      <label className="block">
        <span className="field-label">Webhook URL</span>
        <input value={form.webhookUrl} onChange={(event) => setForm({ ...form, webhookUrl: event.target.value })} className="field" placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." />
      </label>

      <label className="block">
        <span className="field-label">Secret</span>
        <input value={form.secret} onChange={(event) => setForm({ ...form, secret: event.target.value })} className="field" placeholder={mode === 'edit' ? '留空表示沿用当前 Secret' : '可选，用于签名校验'} />
      </label>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <label className="block">
          <span className="field-label">最小等级</span>
          <select value={form.minLevel} onChange={(event) => setForm({ ...form, minLevel: event.target.value as FeishuChannelFormValues['minLevel'] })} className="field">
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </label>

        <label className="flex rounded-[16px] border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
          <span className="flex items-center gap-3">
            <input type="checkbox" checked={form.enabled} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
            保存后立即启用该通道
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? '保存中…' : mode === 'edit' ? '保存修改' : '保存飞书通道'}
        </button>
        {mode === 'edit' ? (
          <button type="button" onClick={onCancel} className="btn-secondary">
            取消编辑
          </button>
        ) : null}
      </div>

      {message ? <div className="notice-success">{message}</div> : null}
      {error ? <div className="notice-error">{error}</div> : null}
    </form>
  );
}

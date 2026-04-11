'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type ModelOption = {
  id: string;
  label: string;
};

function blockedReason(modelId: string) {
  if (/^default\/glm-/i.test(modelId)) {
    return 'GLM-5 这类兼容模型当前会导致 OpenClaw 工具调用不稳定，不能设为默认 Agent 模型。';
  }
  return '';
}

export function DefaultModelPicker({ models, defaultModelId }: { models: ModelOption[]; defaultModelId?: string }) {
  const router = useRouter();
  const [modelId, setModelId] = useState(defaultModelId || models[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const currentBlockedReason = useMemo(() => blockedReason(modelId), [modelId]);

  async function save() {
    if (currentBlockedReason) {
      setMessage('');
      setError(currentBlockedReason);
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/v1/models/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!response.ok || payload.ok === false) throw new Error(payload.error || '切换失败');
      setMessage('默认模型已切换');
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '切换失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface-soft px-4 py-4 text-[13px] leading-6 text-slate-600">
        新 Agent 或继承默认模型的 Agent，会优先使用这里设置的默认模型。
      </div>
      <div className="space-y-3">
        <select value={modelId} onChange={(event) => setModelId(event.target.value)} className="field text-slate-900">
          {models.map((model) => {
            const reason = blockedReason(model.id);
            return (
              <option key={model.id} value={model.id} disabled={Boolean(reason)}>
                {reason ? `${model.label} · 已禁用` : model.label}
              </option>
            );
          })}
        </select>
        <button type="button" onClick={save} disabled={loading || !modelId || Boolean(currentBlockedReason)} className="btn-primary w-full justify-center">
          {loading ? '切换中…' : '设为默认模型'}
        </button>
      </div>
      {currentBlockedReason ? <div className="notice-error">{currentBlockedReason}</div> : null}
      {message ? <div className="notice-success">{message}</div> : null}
      {error ? <div className="notice-error">{error}</div> : null}
    </div>
  );
}

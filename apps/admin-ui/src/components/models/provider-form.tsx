'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

export type ProviderModelFormValue = {
  id: string;
  name: string;
};

export type ProviderFormValues = {
  id: string;
  name: string;
  websiteUrl: string;
  notes: string;
  type: 'openai-compatible' | 'anthropic' | 'gemini' | 'ollama';
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  isDefault: boolean;
  modelId: string;
  modelName: string;
  models: ProviderModelFormValue[];
  defaultModelId: string;
};

const EMPTY_MODEL: ProviderModelFormValue = { id: '', name: '' };

export const DEFAULT_PROVIDER_FORM: ProviderFormValues = {
  id: '',
  name: '',
  websiteUrl: '',
  notes: '',
  type: 'openai-compatible',
  baseUrl: '',
  apiKey: '',
  enabled: true,
  isDefault: false,
  modelId: '',
  modelName: '',
  models: [{ ...EMPTY_MODEL }],
  defaultModelId: ''
};

function sanitizeModels(models: ProviderModelFormValue[]) {
  return models
    .map((item) => ({ id: item.id.trim(), name: item.name.trim() }))
    .filter((item) => item.id && item.name);
}

export function ProviderForm({
  initialValue,
  mode = 'create',
  onSaved,
  onCancel
}: {
  initialValue?: ProviderFormValues;
  mode?: 'create' | 'edit';
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const seed = useMemo(() => {
    const next = initialValue ?? DEFAULT_PROVIDER_FORM;
    const nextModels = next.models.length ? next.models : [{ ...EMPTY_MODEL }];
    return {
      ...next,
      models: nextModels,
      defaultModelId: next.defaultModelId || next.modelId || nextModels[0]?.id || ''
    };
  }, [initialValue]);
  const [form, setForm] = useState<ProviderFormValues>(seed);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(seed);
    setMessage('');
    setError('');
  }, [seed]);

  function update<K extends keyof ProviderFormValues>(key: K, value: ProviderFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateModel(index: number, key: keyof ProviderModelFormValue, value: string) {
    setForm((current) => {
      const nextModels = current.models.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      );
      const sanitized = sanitizeModels(nextModels);
      const defaultModelStillExists = sanitized.some((item) => item.id === current.defaultModelId);

      return {
        ...current,
        models: nextModels,
        defaultModelId: defaultModelStillExists ? current.defaultModelId : sanitized[0]?.id || ''
      };
    });
  }

  function addModel() {
    setForm((current) => ({ ...current, models: [...current.models, { ...EMPTY_MODEL }] }));
  }

  function removeModel(index: number) {
    setForm((current) => {
      const nextModels = current.models.filter((_, itemIndex) => itemIndex !== index);
      const fallbackModels = nextModels.length ? nextModels : [{ ...EMPTY_MODEL }];
      const sanitized = sanitizeModels(fallbackModels);
      const defaultModelStillExists = sanitized.some((item) => item.id === current.defaultModelId);

      return {
        ...current,
        models: fallbackModels,
        defaultModelId: defaultModelStillExists ? current.defaultModelId : sanitized[0]?.id || ''
      };
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const isEdit = mode === 'edit';
      const models = sanitizeModels(form.models);
      if (!models.length) {
        throw new Error('至少填写一个完整模型（模型 ID + 模型名称）');
      }

      const defaultModelId = form.defaultModelId && models.some((item) => item.id === form.defaultModelId)
        ? form.defaultModelId
        : models[0].id;

      const payload = {
        ...form,
        modelId: models[0].id,
        modelName: models[0].name,
        models,
        defaultModelId
      };

      const response = await fetch(isEdit ? `/api/admin/v1/providers/${form.id}` : '/api/admin/v1/providers', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || '保存失败');
      }
      setMessage(isEdit ? 'Provider 已更新' : 'Provider 已保存');
      if (!isEdit) {
        setForm(DEFAULT_PROVIDER_FORM);
      }
      onSaved?.();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存失败');
    } finally {
      setLoading(false);
    }
  }

  const completedModels = useMemo(() => sanitizeModels(form.models), [form.models]);
  const selectedDefaultModel = useMemo(
    () => completedModels.find((model) => model.id === form.defaultModelId) || completedModels[0],
    [completedModels, form.defaultModelId]
  );

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-600">
        {mode === 'edit'
          ? '安全编辑模式：API Key 留空时保留现有值；现在也支持在同一个 Provider 下维护多模型。'
          : '新建模式会写入一套新的 Provider 配置；支持一次录入多个模型，适合接入统一网关。'}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-sm text-slate-700">供应商标识</span>
          <input
            value={form.id}
            disabled={mode === 'edit'}
            onChange={(event) => update('id', event.target.value)}
            className="field disabled:cursor-not-allowed disabled:opacity-70"
            placeholder="default / claude / gemini / custom-id"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-slate-700">供应商名称</span>
          <input value={form.name} onChange={(event) => update('name', event.target.value)} className="field" placeholder="例如：Claude 官方 / 公司专用网关" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-slate-700">官网链接</span>
          <input value={form.websiteUrl} onChange={(event) => update('websiteUrl', event.target.value)} className="field" placeholder="https://example.com（可选）" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-slate-700">备注</span>
          <input value={form.notes} onChange={(event) => update('notes', event.target.value)} className="field" placeholder="例如：公司专用账号 / OpenAI 兼容转发" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-slate-700">类型</span>
          <select value={form.type} onChange={(event) => update('type', event.target.value as ProviderFormValues['type'])} className="field">
            <option value="openai-compatible">OpenAI Compatible</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="ollama">Ollama</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-slate-700">API 请求地址</span>
          <input value={form.baseUrl} onChange={(event) => update('baseUrl', event.target.value)} className="field" placeholder="https://your-api-endpoint.com/v1" />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm text-slate-700">API Key</span>
          <input value={form.apiKey} onChange={(event) => update('apiKey', event.target.value)} className="field" placeholder={mode === 'edit' ? '留空表示不覆盖当前值' : '只需要填这里'} />
        </label>
      </div>

      <section className="space-y-4 rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">模型目录</div>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">同一个 Provider 下可维护多个模型。比如你可以在 `default` 下面同时放 `kimi-k2.5`、`codex-5.4`。</p>
          </div>
          <button type="button" onClick={addModel} className="btn-secondary px-4 py-2 text-xs">
            新增模型
          </button>
        </div>

        <div className="space-y-3">
          {form.models.map((model, index) => (
            <div key={index} className="rounded-[20px] border border-white/90 bg-white/90 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] md:items-end">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-700">模型 ID</span>
                  <input
                    aria-label="模型 ID"
                    value={model.id}
                    onChange={(event) => updateModel(index, 'id', event.target.value)}
                    className="field"
                    placeholder="gpt-5.4 / codex-5.4 / claude-sonnet-4-5"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-700">模型名称</span>
                  <input
                    aria-label="模型名称"
                    value={model.name}
                    onChange={(event) => updateModel(index, 'name', event.target.value)}
                    className="field"
                    placeholder="GPT 5.4 / Codex 5.4"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeModel(index)}
                  disabled={form.models.length <= 1}
                  className="btn-danger px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 rounded-[20px] border border-white/90 bg-white/80 p-4">
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input type="checkbox" checked={form.isDefault} onChange={(event) => update('isDefault', event.target.checked)} className="mt-1" />
            <span className="min-w-0 leading-6">保存后同时切换为平台默认模型</span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">默认模型</span>
            <select
              aria-label="默认模型"
              value={form.defaultModelId}
              onChange={(event) => update('defaultModelId', event.target.value)}
              className="field w-full min-w-0"
              disabled={!completedModels.length}
            >
              {completedModels.length ? completedModels.map((model) => (
                <option key={model.id} value={model.id}>{model.name}</option>
              )) : <option value="">请先填写完整模型</option>}
            </select>
          </label>
          {selectedDefaultModel ? (
            <div className="break-all text-xs leading-6 text-slate-500">
              当前选择：{selectedDefaultModel.name} · {selectedDefaultModel.id}
            </div>
          ) : null}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? '保存中…' : mode === 'edit' ? '保存修改' : '保存 Provider'}
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

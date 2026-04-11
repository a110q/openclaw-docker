'use client';

import { useMemo, useState } from 'react';
import type { ProviderRecord } from '@/lib/types/admin';
import { ProviderForm, type ProviderFormValues, DEFAULT_PROVIDER_FORM } from './provider-form';
import { ProviderList } from './provider-list';

function toFormValues(provider: ProviderRecord): ProviderFormValues {
  return {
    id: provider.id,
    name: provider.name || provider.id,
    websiteUrl: provider.websiteUrl || '',
    notes: provider.notes || '',
    type: provider.type,
    baseUrl: provider.baseUrl,
    apiKey: '',
    enabled: provider.enabled,
    isDefault: provider.isDefault,
    modelId: provider.modelId || '',
    modelName: provider.modelName || provider.modelId || '',
    models: provider.models?.length
      ? provider.models.map((model) => ({ id: model.id, name: model.name || model.id }))
      : [{ id: provider.modelId || '', name: provider.modelName || provider.modelId || '' }],
    defaultModelId: provider.defaultModelId || provider.modelId || ''
  };
}

export function ProviderManager({ providers }: { providers: ProviderRecord[] }) {
  const defaultForm = useMemo(() => DEFAULT_PROVIDER_FORM, []);
  const [editingProviderId, setEditingProviderId] = useState('');

  const editingProvider = providers.find((item) => item.id === editingProviderId);

  return (
    <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px] 2xl:items-start">
      <div className="surface-panel p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="page-eyebrow">Managed Providers</div>
            <h2 className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">当前 Provider</h2>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">支持在线编辑、连通性测试和删除自定义 Provider。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="pill-badge">共 {providers.length} 条</span>
            {editingProvider ? (
              <button type="button" onClick={() => setEditingProviderId('')} className="btn-secondary px-4 py-2 text-xs">
                新建 Provider
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-4">
          <ProviderList providers={providers} editingProviderId={editingProviderId} onEdit={(provider) => setEditingProviderId(provider.id)} />
        </div>
      </div>

      <div className="surface-panel p-5 md:p-6 2xl:sticky 2xl:top-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="page-eyebrow">Provider Editor</div>
            <h2 className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">
              {editingProvider ? `编辑 Provider · ${editingProvider.id}` : '新增 / 覆盖 Provider'}
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              {editingProvider
                ? '修改后会写回 .env / openclaw.json。API Key 留空时沿用当前值，更适合安全微调。'
                : '适合直接接入新的模型网关，也可覆盖已有 Provider 配置。'}
            </p>
          </div>
          {editingProvider ? <span className="pill-badge border-violet-200 bg-violet-50 text-violet-700">就地编辑</span> : null}
        </div>
        <div className="mt-4">
          <ProviderForm
            mode={editingProvider ? 'edit' : 'create'}
            initialValue={editingProvider ? toFormValues(editingProvider) : defaultForm}
            onSaved={() => setEditingProviderId('')}
            onCancel={() => setEditingProviderId('')}
          />
        </div>
      </div>
    </section>
  );
}

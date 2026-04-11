'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProviderRecord } from '@/lib/types/admin';
import { canDeleteProvider } from '@/lib/ui/provider-guards';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';

type ProviderTestPayload = {
  ok?: boolean;
  data?: {
    ok?: boolean;
    status?: number;
    endpoint?: string;
    modelId?: string;
    stages?: string[];
    modelValidated?: boolean;
    error?: string;
  };
  error?: string;
};

export function ProviderList({
  providers,
  onEdit,
  editingProviderId
}: {
  providers: ProviderRecord[];
  onEdit: (provider: ProviderRecord) => void;
  editingProviderId?: string;
}) {
  const router = useRouter();
  const [testingIds, setTestingIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmProviderId, setConfirmProviderId] = useState('');

  const confirmTarget = useMemo(
    () => providers.find((provider) => provider.id === confirmProviderId),
    [providers, confirmProviderId]
  );

  async function testProvider(providerId: string) {
    setTestingIds((current) => current.includes(providerId) ? current : [...current, providerId]);
    setMessage('');
    setError('');

    try {
      const response = await fetch(`/api/admin/v1/providers/${providerId}/test`, { method: 'POST' });
      const payload = (await response.json().catch(() => ({}))) as ProviderTestPayload;
      const data = payload.data;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || payload.error || '测试失败');
      }
      setMessage(`Provider ${providerId} 真实模型测试成功，HTTP ${data.status ?? 0}`);
      router.refresh();
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : '测试失败');
    } finally {
      setTestingIds((current) => current.filter((item) => item !== providerId));
    }
  }

  async function removeProvider(providerId: string) {
    setDeletingId(providerId);
    setMessage('');
    setError('');

    try {
      const response = await fetch(`/api/admin/v1/providers/${providerId}`, { method: 'DELETE' });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || '删除 Provider 失败');
      }
      setConfirmProviderId('');
      setMessage(`Provider ${providerId} 已删除`);
      router.refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '删除 Provider 失败');
      setConfirmProviderId('');
    } finally {
      setDeletingId('');
    }
  }

  return (
    <>
      <div className="space-y-3">
        <div className="rounded-2xl border border-sky-200/70 bg-sky-50/80 px-4 py-3 text-sm leading-6 text-sky-900">
          当前“测试”会带真实 API Key 做两段校验：先验证模型目录，再发一个极小真实请求验证模型是否可调用。它不会给飞书或外部聊天渠道发消息，但会消耗极少量模型额度。
        </div>

        {providers.map((provider) => {
          const isEditing = provider.id === editingProviderId;
          const isTesting = testingIds.includes(provider.id);
          const isDeleting = deletingId === provider.id;
          const deletable = canDeleteProvider(provider.id);
          const providerModels = provider.models?.length
            ? provider.models
            : provider.modelId
              ? [{ id: provider.modelId, name: provider.modelName || provider.modelId, capabilities: [] }]
              : [];

          return (
            <div key={provider.id} className={`list-row transition ${isEditing ? 'border-violet-200 bg-violet-50/80 shadow-[0_10px_24px_rgba(109,40,217,0.08)]' : ''}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">{provider.id}</div>
                    {provider.isDefault ? <span className="pill-badge border-emerald-200 bg-emerald-50 text-emerald-700">默认 Provider</span> : null}
                    {isEditing ? <span className="pill-badge border-violet-200 bg-violet-50 text-violet-700">编辑中</span> : null}
                  </div>
                  <div className="mt-1 break-all text-[13px] leading-6 text-slate-600">{provider.type} · {provider.baseUrl}</div>
                  {provider.websiteUrl ? <div className="mt-1 break-all text-xs text-slate-500">官网：{provider.websiteUrl}</div> : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => onEdit(provider)} className="btn-secondary px-4 py-2 text-xs">
                    {isEditing ? '继续编辑' : '编辑'}
                  </button>
                  <button
                    type="button"
                    onClick={() => testProvider(provider.id)}
                    disabled={isTesting}
                    className="btn-primary px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isTesting ? '测试中…' : '真实测试'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmProviderId(provider.id)}
                    disabled={isDeleting || isTesting || !deletable}
                    className="btn-danger px-4 py-2 text-xs disabled:opacity-50"
                    title={deletable ? '删除自定义 Provider' : '内置 Provider 不支持删除'}
                  >
                    {isDeleting ? '删除中…' : '删除'}
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <div className="rounded-[16px] border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[13px] text-slate-700">模型数：{provider.modelCount}</div>
                <div className="rounded-[16px] border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[13px] text-slate-700">当前默认：{provider.modelName || provider.modelId || '未配置'}</div>
                <div className="rounded-[16px] border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[13px] text-slate-700">状态：{provider.lastTestStatus}</div>
                <div className="rounded-[16px] border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[13px] text-slate-700">上次测试：{provider.lastTestAt ? new Date(provider.lastTestAt).toLocaleString('zh-CN') : '未测试'}</div>
              </div>

              {providerModels.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {providerModels.map((model) => (
                    <div key={model.id} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${provider.defaultModelId === model.id ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                      <span className="font-medium">{model.name}</span>
                      <span className="text-slate-400">{model.id}</span>
                      {provider.defaultModelId === model.id ? <span>默认</span> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 break-all text-xs leading-5 text-slate-500">API Key：{provider.apiKeyConfigured ? provider.apiKeyMasked : '未配置'}</div>
              {provider.notes ? <div className="mt-2 text-xs leading-5 text-slate-500">备注：{provider.notes}</div> : null}
              {provider.lastError ? <div className="notice-error mt-3">{provider.lastError}</div> : null}
            </div>
          );
        })}
        {message ? <div className="notice-success">{message}</div> : null}
        {error ? <div className="notice-error">{error}</div> : null}
      </div>

      <ConfirmActionDialog
        open={Boolean(confirmTarget)}
        title={confirmTarget ? `删除 Provider · ${confirmTarget.id}` : '删除 Provider'}
        description={confirmTarget ? `删除后将移除 ${confirmTarget.id} 的 Provider 配置。该操作不会自动删除 .env 中无关条目。` : ''}
        confirmLabel="确认删除"
        pending={confirmTarget ? deletingId === confirmTarget.id : false}
        onClose={() => setConfirmProviderId('')}
        onConfirm={() => confirmTarget && removeProvider(confirmTarget.id)}
      />
    </>
  );
}

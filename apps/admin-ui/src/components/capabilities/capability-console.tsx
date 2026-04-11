'use client';

import { useMemo, useState } from 'react';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';
import type { HostCapabilityDefinition, HostCapabilityExecution, HostCapabilityId, HostCapabilityPreview } from '@/lib/types/host-capabilities';
import { CapabilityResultView } from './capability-result-view';

type CapabilityDraftMap = Record<HostCapabilityId, Record<string, any>>;

const DEFAULT_DRAFTS: CapabilityDraftMap = {
  'host.compose.ps': {},
  'host.compose.logs': { service: 'openclaw-gateway', tail: 120 },
  'host.provider.upsert': {
    id: '',
    name: '',
    type: 'openai-compatible',
    baseUrl: '',
    apiKey: '',
    enabled: true,
    isDefault: false,
    modelId: '',
    modelName: ''
  },
  'host.alert.feishu.upsert': {
    id: '',
    name: '',
    webhookUrl: '',
    secret: '',
    enabled: true,
    minLevel: 'warning'
  },
  'host.service.recreateGateway': {}
};

function riskLabel(riskLevel: HostCapabilityDefinition['riskLevel']) {
  switch (riskLevel) {
    case 'danger':
      return '高风险';
    case 'write':
      return '写入';
    default:
      return '只读';
  }
}

export function CapabilityConsole({ capabilities }: { capabilities: HostCapabilityDefinition[] }) {
  const [selectedId, setSelectedId] = useState<HostCapabilityId>(capabilities[0]?.id ?? 'host.compose.ps');
  const [drafts, setDrafts] = useState<CapabilityDraftMap>(DEFAULT_DRAFTS);
  const [preview, setPreview] = useState<HostCapabilityPreview | null>(null);
  const [execution, setExecution] = useState<HostCapabilityExecution | null>(null);
  const [loadingAction, setLoadingAction] = useState<'preview' | 'execute' | ''>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedCapability = useMemo(
    () => capabilities.find((item) => item.id === selectedId) ?? capabilities[0],
    [capabilities, selectedId]
  );

  if (!selectedCapability) {
    return null;
  }

  const selectedInput = drafts[selectedCapability.id];

  function selectCapability(id: HostCapabilityId) {
    setSelectedId(id);
    setMessage('');
    setError('');
    setPreview(null);
    setExecution(null);
    setConfirmOpen(false);
  }

  function updateSelectedInput(key: string, value: unknown) {
    setDrafts((current) => ({
      ...current,
      [selectedCapability.id]: {
        ...current[selectedCapability.id],
        [key]: value
      }
    }));
  }

  async function runPreview() {
    setLoadingAction('preview');
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/admin/v1/host-capabilities/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilityId: selectedCapability.id, input: selectedInput })
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: HostCapabilityPreview; error?: string };
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || '预览失败');
      }
      setPreview(payload.data);
      setMessage('预览已生成');
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : '预览失败');
    } finally {
      setLoadingAction('');
    }
  }

  async function runExecute(confirmed: boolean) {
    setLoadingAction('execute');
    setMessage('');
    setError('');
    setConfirmOpen(false);

    try {
      const body: Record<string, unknown> = {
        capabilityId: selectedCapability.id,
        input: selectedInput
      };
      if (selectedCapability.requiresConfirmation) {
        body.confirmed = confirmed;
      }

      const response = await fetch('/api/admin/v1/host-capabilities/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; data?: HostCapabilityExecution; error?: string };
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(payload.error || '执行失败');
      }
      setExecution(payload.data);
      setMessage(payload.data.summary || '执行成功');
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : '执行失败');
    } finally {
      setLoadingAction('');
    }
  }

  function requestExecute() {
    if (selectedCapability.requiresConfirmation) {
      setConfirmOpen(true);
      return;
    }

    void runExecute(true);
  }

  function renderInputFields() {
    if (selectedCapability.id === 'host.compose.ps') {
      return (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
          该能力无需额外参数，将返回当前 Docker Compose 服务状态。
        </div>
      );
    }

    if (selectedCapability.id === 'host.compose.logs') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">服务名称</span>
            <input value={selectedInput.service ?? ''} onChange={(event) => updateSelectedInput('service', event.target.value)} className="field" placeholder="openclaw-gateway" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">日志行数</span>
            <input value={selectedInput.tail ?? 120} onChange={(event) => updateSelectedInput('tail', Number(event.target.value) || 0)} className="field" type="number" min={1} max={500} />
          </label>
        </div>
      );
    }

    if (selectedCapability.id === 'host.provider.upsert') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">Provider ID</span>
            <input value={selectedInput.id ?? ''} onChange={(event) => updateSelectedInput('id', event.target.value)} className="field" placeholder="provider-main" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">显示名称</span>
            <input value={selectedInput.name ?? ''} onChange={(event) => updateSelectedInput('name', event.target.value)} className="field" placeholder="Provider Main" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">类型</span>
            <select value={selectedInput.type ?? 'openai-compatible'} onChange={(event) => updateSelectedInput('type', event.target.value)} className="field">
              <option value="openai-compatible">OpenAI Compatible</option>
              <option value="anthropic">Anthropic</option>
              <option value="gemini">Gemini</option>
              <option value="ollama">Ollama</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">Base URL</span>
            <input value={selectedInput.baseUrl ?? ''} onChange={(event) => updateSelectedInput('baseUrl', event.target.value)} className="field" placeholder="https://proxy.example/v1" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm text-slate-700">API Key</span>
            <input value={selectedInput.apiKey ?? ''} onChange={(event) => updateSelectedInput('apiKey', event.target.value)} className="field" placeholder="sk-..." />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">模型 ID</span>
            <input value={selectedInput.modelId ?? ''} onChange={(event) => updateSelectedInput('modelId', event.target.value)} className="field" placeholder="gpt-5.4" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">模型名称</span>
            <input value={selectedInput.modelName ?? ''} onChange={(event) => updateSelectedInput('modelName', event.target.value)} className="field" placeholder="GPT 5.4" />
          </label>
        </div>
      );
    }

    if (selectedCapability.id === 'host.alert.feishu.upsert') {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">通道 ID</span>
            <input value={selectedInput.id ?? ''} onChange={(event) => updateSelectedInput('id', event.target.value)} className="field" placeholder="feishu-main" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-slate-700">通道名称</span>
            <input value={selectedInput.name ?? ''} onChange={(event) => updateSelectedInput('name', event.target.value)} className="field" placeholder="生产告警" />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm text-slate-700">Webhook URL</span>
            <input value={selectedInput.webhookUrl ?? ''} onChange={(event) => updateSelectedInput('webhookUrl', event.target.value)} className="field" placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." />
          </label>
          <label className="block md:col-span-2">
            <span className="mb-2 block text-sm text-slate-700">Secret</span>
            <input value={selectedInput.secret ?? ''} onChange={(event) => updateSelectedInput('secret', event.target.value)} className="field" placeholder="可选签名密钥" />
          </label>
        </div>
      );
    }

    return (
      <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-6 text-amber-700">
        该能力将执行 `docker compose up -d --force-recreate openclaw-gateway`，用于在修改 Provider / API Key 等宿主机配置后重建 Gateway。
      </div>
    );
  }

  return (
    <>
      <section className="grid gap-4 2xl:grid-cols-[360px_minmax(0,1fr)] 2xl:items-start">
        <div className="surface-panel p-5 md:p-6 2xl:sticky 2xl:top-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="section-title">能力目录</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-600">通过白名单能力访问宿主机操作，而不是让 sandbox 直接越权。</p>
            </div>
            <span className="pill-badge">Phase 1</span>
          </div>

          <div className="mt-5 space-y-3">
            {capabilities.map((capability) => {
              const active = capability.id === selectedCapability.id;
              return (
                <button
                  key={capability.id}
                  type="button"
                  aria-label={capability.title}
                  onClick={() => selectCapability(capability.id)}
                  className={[
                    'w-full rounded-[20px] border px-4 py-4 text-left transition',
                    active
                      ? 'border-sky-200 bg-[linear-gradient(180deg,rgba(247,251,255,0.98)_0%,rgba(255,255,255,0.98)_100%)] shadow-[0_12px_26px_rgba(0,113,227,0.08)]'
                      : 'border-slate-200 bg-white/92 hover:border-sky-100 hover:bg-white'
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-semibold text-slate-900">{capability.title}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-500">{riskLabel(capability.riskLevel)}</span>
                      {capability.requiresConfirmation ? <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] text-amber-700">需确认</span> : null}
                    </div>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-slate-600">{capability.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-panel p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="page-eyebrow">Selected Capability</div>
                <h2 className="mt-3 text-[1.35rem] font-semibold tracking-tight text-slate-900">{selectedCapability.title}</h2>
                <p className="mt-2 text-[13px] leading-6 text-slate-600">{selectedCapability.description}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="pill-badge">{riskLabel(selectedCapability.riskLevel)}</span>
                <span className="pill-badge">目标：{selectedCapability.targetType}</span>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {renderInputFields()}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200/80 pt-4">
              <button type="button" onClick={() => void runPreview()} disabled={Boolean(loadingAction)} className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60">
                {loadingAction === 'preview' ? '预览中…' : '预览变更'}
              </button>
              <button type="button" onClick={requestExecute} disabled={Boolean(loadingAction)} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
                {loadingAction === 'execute' ? '执行中…' : '执行能力'}
              </button>
            </div>

            {message ? <div className="mt-4 notice-success">{message}</div> : null}
            {error ? <div className="mt-4 notice-error">{error}</div> : null}
          </div>

          <CapabilityResultView preview={preview} execution={execution} />
        </div>
      </section>

      <ConfirmActionDialog
        open={confirmOpen}
        title="确认执行高风险能力"
        description={`即将执行：${selectedCapability.title}。该动作可能影响服务可用性，请确认你已完成预览并知晓影响。`}
        confirmLabel="确认执行"
        pending={loadingAction === 'execute'}
        onConfirm={() => void runExecute(true)}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ModelOption = { id: string; label: string };
type AgentOption = { id: string; name: string; primaryModelId: string };

export function AgentBindingsManager({ agents, models, focusAgentId = '' }: { agents: AgentOption[]; models: ModelOption[]; focusAgentId?: string }) {
  const router = useRouter();
  const [state, setState] = useState(Object.fromEntries(agents.map((agent) => [agent.id, agent.primaryModelId])) as Record<string, string>);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!focusAgentId) return;
    const element = document.getElementById(`agent-binding-${focusAgentId}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusAgentId]);

  async function save(agentId: string) {
    setLoading(agentId);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/admin/v1/agents/${agentId}/bindings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primaryModelId: state[agentId] })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || '保存失败');
      setMessage(`已更新 ${agentId} 的模型绑定`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setLoading('');
    }
  }

  return (
    <div className="space-y-3">
      {agents.map((agent) => {
        const focused = focusAgentId === agent.id;
        return (
          <div key={agent.id} id={`agent-binding-${agent.id}`} className={`list-row transition ${focused ? 'border-sky-300 bg-sky-50/80 shadow-[0_12px_28px_rgba(14,165,233,0.14)]' : ''}`}>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0 xl:max-w-[260px]">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-900">{agent.name}</div>
                  {focused ? <span className="pill-badge border-sky-200 bg-sky-50 text-sky-700">从飞书页跳转</span> : null}
                </div>
                <div className="mt-1 text-xs tracking-wide text-slate-400">{agent.id}</div>
              </div>
              <div className="flex flex-1 flex-col gap-3 lg:flex-row xl:max-w-3xl">
                <select value={state[agent.id] || ''} onChange={(event) => setState((current) => ({ ...current, [agent.id]: event.target.value }))} className="field flex-1 text-slate-900">
                  {models.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
                </select>
                <button type="button" onClick={() => save(agent.id)} disabled={loading === agent.id} className="btn-secondary whitespace-nowrap">
                  {loading === agent.id ? '保存中…' : '保存绑定'}
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {message ? <div className="notice-success">{message}</div> : null}
      {error ? <div className="notice-error">{error}</div> : null}
    </div>
  );
}

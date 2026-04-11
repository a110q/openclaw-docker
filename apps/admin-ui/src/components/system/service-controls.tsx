'use client';

import { useState } from 'react';

const ACTIONS = [
  {
    action: 'recreate',
    label: '强制重建',
    hint: '改 API Key / 环境变量 / 镜像后优先使用。',
    detail: '会重建容器，确保新的环境变量、镜像和挂载配置真正生效。',
    badge: '重载环境',
    tone: 'danger'
  },
  {
    action: 'restart',
    label: '平滑重启',
    hint: '保留当前配置，快速刷新运行态。',
    detail: '适合 live 配置已落盘，但容器还没重新读取的场景。',
    badge: '低风险',
    tone: 'primary'
  },
  {
    action: 'start',
    label: '启动服务',
    hint: '适合初次拉起或异常停止后恢复。',
    detail: '执行 up，让 Gateway 重新回到可用态。',
    badge: '恢复服务',
    tone: 'neutral'
  },
  {
    action: 'stop',
    label: '停止服务',
    hint: '暂停 Gateway，对外入口会暂时不可用。',
    detail: '适合短时停服、切换配置窗口或做人为干预时使用。',
    badge: '暂停入口',
    tone: 'neutral'
  }
] as const;

const GUIDES = [
  {
    title: '改 `.env`、API Key、Base URL',
    action: '优先强制重建',
    tone: 'danger'
  },
  {
    title: '只改 live 配置或轻微异常',
    action: '先做平滑重启',
    tone: 'primary'
  }
] as const;

function cardTone(tone: (typeof ACTIONS)[number]['tone']) {
  if (tone === 'primary') {
    return 'border-sky-200/90 bg-[linear-gradient(180deg,rgba(240,249,255,0.98)_0%,rgba(255,255,255,0.95)_100%)] text-sky-950 hover:border-sky-300 hover:shadow-[0_14px_28px_rgba(14,116,144,0.08)]';
  }
  if (tone === 'danger') {
    return 'border-rose-200/90 bg-[linear-gradient(180deg,rgba(255,241,242,0.98)_0%,rgba(255,255,255,0.95)_100%)] text-rose-950 hover:border-rose-300 hover:shadow-[0_14px_28px_rgba(225,29,72,0.08)]';
  }
  return 'border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.95)_100%)] text-slate-900 hover:border-slate-300 hover:shadow-[0_14px_28px_rgba(15,23,42,0.05)]';
}

function badgeTone(tone: (typeof ACTIONS)[number]['tone']) {
  if (tone === 'primary') return 'border-sky-100 bg-sky-50 text-sky-700';
  if (tone === 'danger') return 'border-rose-100 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function dotTone(tone: (typeof ACTIONS)[number]['tone']) {
  if (tone === 'primary') return 'bg-sky-500';
  if (tone === 'danger') return 'bg-rose-500';
  return 'bg-slate-300';
}

function hintTone(tone: (typeof ACTIONS)[number]['tone']) {
  if (tone === 'primary') return 'text-sky-900/85';
  if (tone === 'danger') return 'text-rose-900/85';
  return 'text-slate-600';
}

function guideTone(tone: (typeof GUIDES)[number]['tone']) {
  if (tone === 'primary') return 'border-sky-200/80 bg-sky-50/80';
  return 'border-amber-200/80 bg-amber-50/80';
}

export function ServiceControls({ onDone }: { onDone?: () => void }) {
  const [loadingAction, setLoadingAction] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  async function runAction(action: string) {
    setLoadingAction(action);
    setMessage('');
    setError('');

    try {
      const response = await fetch(`/api/admin/v1/system/actions/${action}`, { method: 'POST' });
      const payload = (await response.json().catch(() => ({}))) as { data?: { summary?: string; error?: string } };
      if (!response.ok) {
        throw new Error(payload.data?.error || '执行失败');
      }
      setMessage(payload.data?.summary || `已执行 ${action}`);
      onDone?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '执行失败');
    } finally {
      setLoadingAction('');
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {GUIDES.map((item) => (
          <div key={item.title} className={`rounded-[18px] border px-4 py-3 ${guideTone(item.tone)}`}>
            <div className="text-[13px] font-semibold text-slate-900">{item.title}</div>
            <div className="mt-1 text-[13px] leading-6 text-slate-600">{item.action}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ACTIONS.map((item) => (
          <button
            key={item.action}
            type="button"
            onClick={() => runAction(item.action)}
            disabled={Boolean(loadingAction)}
            className={`rounded-[20px] border px-4 py-4 text-left transition-all duration-200 ${cardTone(item.tone)}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={`pill-badge ${badgeTone(item.tone)}`}>{item.badge}</span>
                <div className="mt-3 text-[15px] font-semibold tracking-tight">
                  {loadingAction === item.action ? `${item.label}中…` : item.label}
                </div>
                <div className={`mt-2 text-[13px] leading-6 ${hintTone(item.tone)}`}>{item.hint}</div>
              </div>
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotTone(item.tone)}`} />
            </div>
            <div className="mt-4 border-t border-black/5 pt-3 text-xs leading-5 text-slate-500">{item.detail}</div>
          </button>
        ))}
      </div>

      {message ? <div className="notice-success">{message}</div> : null}
      {error ? <div className="notice-error">{error}</div> : null}
    </div>
  );
}

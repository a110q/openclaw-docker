'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ClawSwarmSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function runSync() {
    setLoading(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/v1/clawswarm/sync', { method: 'POST' });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; data?: { summary?: string; error?: string } };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || payload.data?.error || 'ClawSwarm 同步失败');
      }
      setMessage(payload.data?.summary || '已发起 ClawSwarm 同步');
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'ClawSwarm 同步失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void runSync()} disabled={loading} className="btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? '同步中…' : '强制同步运行时'}
        </button>
        <div className="text-[12px] leading-5 text-slate-500">用于刷新 ClawSwarm 通讯录，清理已删除 Agent 的旧残留会话。</div>
      </div>
      {message ? <div className="notice-success">{message}</div> : null}
      {error ? <div className="notice-error">{error}</div> : null}
    </div>
  );
}

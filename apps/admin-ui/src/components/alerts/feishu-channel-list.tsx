'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AlertChannel } from '@/lib/types/admin';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';

export function FeishuChannelList({
  channels,
  onEdit,
  editingChannelId
}: {
  channels: AlertChannel[];
  onEdit: (channel: AlertChannel) => void;
  editingChannelId?: string;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmChannelId, setConfirmChannelId] = useState('');

  const confirmTarget = useMemo(
    () => channels.find((channel) => channel.id === confirmChannelId),
    [channels, confirmChannelId]
  );

  async function testChannel(channelId: string) {
    setLoadingId(`test:${channelId}`);
    setMessage('');
    setError('');

    try {
      const response = await fetch(`/api/admin/v1/alerts/channels/${channelId}/test`, { method: 'POST' });
      const payload = (await response.json().catch(() => ({}))) as { data?: { status?: number }; error?: string };
      if (!response.ok && !payload.data) {
        throw new Error(payload.error || '测试失败');
      }
      setMessage(`飞书通道 ${channelId} 测试完成，HTTP ${payload.data?.status ?? 0}`);
      router.refresh();
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : '测试失败');
    } finally {
      setLoadingId('');
    }
  }

  async function deleteChannel(channelId: string) {
    setLoadingId(`delete:${channelId}`);
    setMessage('');
    setError('');

    try {
      const response = await fetch(`/api/admin/v1/alerts/channels/${channelId}`, { method: 'DELETE' });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || '删除失败');
      }
      setConfirmChannelId('');
      setMessage(`飞书通道 ${channelId} 已删除`);
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败');
      setConfirmChannelId('');
    } finally {
      setLoadingId('');
    }
  }

  return (
    <>
      <div className="space-y-3">
        {channels.length ? channels.map((channel) => {
          const isEditing = channel.id === editingChannelId;
          const isTesting = loadingId === `test:${channel.id}`;
          const isDeleting = loadingId === `delete:${channel.id}`;

          return (
            <div key={channel.id} className={`list-row transition ${isEditing ? 'border-violet-200 bg-violet-50/80 shadow-[0_10px_24px_rgba(109,40,217,0.08)]' : ''}`}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-slate-900">{channel.name}</div>
                    <span className="pill-badge">{channel.id}</span>
                    <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">最小等级 {channel.minLevel}</span>
                    {isEditing ? <span className="pill-badge border-violet-200 bg-violet-50 text-violet-700">编辑中</span> : null}
                    {!channel.enabled ? <span className="pill-badge border-slate-200 bg-slate-100 text-slate-500">已停用</span> : <span className="pill-badge border-emerald-200 bg-emerald-50 text-emerald-700">已启用</span>}
                  </div>
                  <div className="mt-2 break-all text-xs leading-5 text-slate-500">{channel.webhookMasked}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onEdit(channel)} className="btn-secondary px-4 py-2 text-xs">
                    {isEditing ? '继续编辑' : '编辑'}
                  </button>
                  <button
                    type="button"
                    onClick={() => testChannel(channel.id)}
                    disabled={Boolean(loadingId)}
                    className="btn-primary px-4 py-2 text-xs"
                  >
                    {isTesting ? '测试中…' : '发送测试消息'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmChannelId(channel.id)}
                    disabled={Boolean(loadingId)}
                    className="btn-danger px-4 py-2 text-xs"
                  >
                    {isDeleting ? '删除中…' : '删除'}
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <div className="rounded-[16px] border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[13px] text-slate-700">启用：{channel.enabled ? '是' : '否'}</div>
                <div className="rounded-[16px] border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[13px] text-slate-700">状态：{channel.lastTestStatus}</div>
                <div className="rounded-[16px] border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-[13px] text-slate-700">上次测试：{channel.lastTestAt ? new Date(channel.lastTestAt).toLocaleString('zh-CN') : '未测试'}</div>
              </div>

              {channel.lastError ? <div className="notice-error mt-3">{channel.lastError}</div> : null}
            </div>
          );
        }) : <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">暂无飞书通道</div>}
        {message ? <div className="notice-success">{message}</div> : null}
        {error ? <div className="notice-error">{error}</div> : null}
      </div>

      <ConfirmActionDialog
        open={Boolean(confirmTarget)}
        title={confirmTarget ? `删除飞书通道 · ${confirmTarget.id}` : '删除飞书通道'}
        description={confirmTarget ? `删除后将移除 ${confirmTarget.name} 的告警发送配置，现有规则不会自动删除关联。` : ''}
        confirmLabel="确认删除"
        pending={confirmTarget ? loadingId === `delete:${confirmTarget.id}` : false}
        onClose={() => setConfirmChannelId('')}
        onConfirm={() => confirmTarget && deleteChannel(confirmTarget.id)}
      />
    </>
  );
}

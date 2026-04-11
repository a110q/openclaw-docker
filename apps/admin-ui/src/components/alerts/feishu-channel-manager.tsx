'use client';

import { useMemo, useState } from 'react';
import type { AlertChannel } from '@/lib/types/admin';
import { DEFAULT_FEISHU_CHANNEL_FORM, FeishuChannelForm, type FeishuChannelFormValues } from './feishu-channel-form';
import { FeishuChannelList } from './feishu-channel-list';

function toFormValues(channel: AlertChannel): FeishuChannelFormValues {
  return {
    id: channel.id,
    name: channel.name,
    webhookUrl: channel.webhookUrl || '',
    secret: '',
    enabled: channel.enabled,
    minLevel: channel.minLevel
  };
}

export function FeishuChannelManager({ channels }: { channels: AlertChannel[] }) {
  const defaultForm = useMemo(() => DEFAULT_FEISHU_CHANNEL_FORM, []);
  const [editingChannelId, setEditingChannelId] = useState('');

  const editingChannel = channels.find((item) => item.id === editingChannelId);
  const enabledCount = channels.filter((item) => item.enabled).length;
  const mutedCount = channels.length - enabledCount;

  return (
    <section className="space-y-4 2xl:sticky 2xl:top-3">
      <div className="surface-panel p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="page-eyebrow">Managed Channels</div>
            <h2 className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">已纳管通道</h2>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">支持测试消息、在线编辑和统一删除确认。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="pill-badge">共 {channels.length} 条</span>
            <span className="pill-badge">启用 {enabledCount}</span>
            {editingChannel ? (
              <button type="button" onClick={() => setEditingChannelId('')} className="btn-secondary px-4 py-2 text-xs">
                新建通道
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="surface-soft px-4 py-4">
            <div className="text-[12px] font-medium text-slate-500">当前启用</div>
            <div className="mt-2 text-[1.2rem] font-semibold tracking-tight text-slate-900">{enabledCount}</div>
            <div className="mt-1 text-[13px] leading-6 text-slate-500">正在参与告警发送的飞书通道。</div>
          </div>
          <div className="surface-soft px-4 py-4">
            <div className="text-[12px] font-medium text-slate-500">停用通道</div>
            <div className="mt-2 text-[1.2rem] font-semibold tracking-tight text-slate-900">{mutedCount}</div>
            <div className="mt-1 text-[13px] leading-6 text-slate-500">保留配置但暂不发送消息。</div>
          </div>
        </div>

        <div className="mt-4">
          <FeishuChannelList channels={channels} editingChannelId={editingChannelId} onEdit={(channel) => setEditingChannelId(channel.id)} />
        </div>
      </div>

      <div className="surface-panel p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="page-eyebrow">Channel Editor</div>
            <h2 className="mt-2 text-[1.35rem] font-semibold tracking-tight text-slate-900">
              {editingChannel ? `编辑飞书通道 · ${editingChannel.id}` : '新增飞书通道'}
            </h2>
            <p className="mt-1 text-[13px] leading-6 text-slate-600">
              {editingChannel
                ? '编辑时 Secret 可留空以沿用现有值，更适合在线微调名称、Webhook 和告警等级。'
                : '适合接入新的飞书机器人通道，并作为纳管通道的补充链路。'}
            </p>
          </div>
          {editingChannel ? <span className="pill-badge border-violet-200 bg-violet-50 text-violet-700">就地编辑</span> : <span className="pill-badge">Create</span>}
        </div>

        <div className="mt-4 rounded-[20px] border border-sky-100 bg-sky-50/70 px-4 py-4 text-[13px] leading-6 text-slate-600">
          新增模式适合补录一个新的 Webhook 通道；编辑模式更适合在线修名称、等级或替换 Webhook 地址。保存后可立即回到上方发送测试消息。
        </div>

        <div className="mt-4">
          <FeishuChannelForm
            mode={editingChannel ? 'edit' : 'create'}
            initialValue={editingChannel ? toFormValues(editingChannel) : defaultForm}
            onSaved={() => setEditingChannelId('')}
            onCancel={() => setEditingChannelId('')}
          />
        </div>
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { FeishuDiscoveredChannel, FeishuDiscoverySnapshot, FeishuRecentMessage } from '@/lib/types/admin';

type EditableDraft = {
  agentId: string;
  enabled: boolean;
  requireMention: boolean;
  bindingKind: 'direct' | 'dm';
};

type MutationPayload = {
  ok?: boolean;
  data?: FeishuDiscoverySnapshot;
  error?: string;
  message?: string;
  restartRecommended?: boolean;
};

const AUTO_RESCAN_MS = 20_000;
const AUTO_RESCAN_SECONDS = AUTO_RESCAN_MS / 1000;

function statusTone(status: FeishuDiscoveredChannel['status']) {
  if (status === 'managed') return 'border-emerald-200 bg-emerald-50/90 text-emerald-700';
  return 'border-amber-200 bg-amber-50/90 text-amber-700';
}

function kindLabel(kind: FeishuDiscoveredChannel['kind']) {
  if (kind === 'bot-account') return '机器人账号';
  if (kind === 'group-binding') return '群绑定';
  return '私聊绑定';
}

function formatScannedAt(value?: string) {
  if (!value) return '未记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function isEditable(item: FeishuDiscoveredChannel) {
  return item.kind === 'group-binding' || item.kind === 'dm-binding';
}

function createDraft(item: FeishuDiscoveredChannel): EditableDraft {
  return {
    agentId: item.agentId || '',
    enabled: item.enabled !== false,
    requireMention: item.requireMention !== false,
    bindingKind: item.bindingKind === 'dm' ? 'dm' : 'direct'
  };
}

function createDraftMap(snapshot: FeishuDiscoverySnapshot) {
  return Object.fromEntries(snapshot.items.filter(isEditable).map((item) => [item.id, createDraft(item)])) as Record<string, EditableDraft>;
}

function detailRows(item: FeishuDiscoveredChannel) {
  return [
    { label: '类型', value: kindLabel(item.kind) },
    { label: '来源', value: item.source },
    { label: '账号', value: item.accountId || 'default' },
    { label: 'Agent', value: item.agentId || '未绑定' },
    { label: item.kind === 'bot-account' ? '账号 ID' : 'Peer ID', value: item.accountId || item.peerId || '未记录' },
    { label: '路由', value: item.bindingKind || 'system' },
    { label: '启用状态', value: item.enabled === false ? '关闭' : '开启' },
    { label: '最近活动', value: item.lastActivityAt ? formatScannedAt(item.lastActivityAt) : '近 3 分钟无消息' }
  ];
}

function createTickerStyle(messageCount: number, active: boolean): CSSProperties {
  const safeCount = Math.max(1, messageCount);
  const duration = active
    ? Math.max(8, safeCount * 3)
    : Math.max(18, safeCount * 6);
  return { ['--ticker-duration' as string]: String(duration) + 's' } as CSSProperties;
}

function previewFeed(messages: FeishuRecentMessage[]) {
  if (!messages.length) return [];
  return [...messages, ...messages];
}

export function FeishuDiscoveryPanel({ initialSnapshot }: { initialSnapshot: FeishuDiscoverySnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [drafts, setDrafts] = useState<Record<string, EditableDraft>>(() => createDraftMap(initialSnapshot));
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState(AUTO_RESCAN_SECONDS);
  const rescanLockRef = useRef(false);

  const activeCount = snapshot.items.filter((item) => item.active).length;
  const autoRefreshPaused = Boolean(editingId || savingId || deletingId);

  const resetCountdown = useCallback(() => {
    setCountdownSeconds(AUTO_RESCAN_SECONDS);
  }, []);

  const applySnapshot = useCallback((next: FeishuDiscoverySnapshot, nextMessage?: string) => {
    setSnapshot(next);
    setDrafts(createDraftMap(next));
    if (nextMessage) setMessage(nextMessage);
  }, []);

  function updateDraft(itemId: string, patch: Partial<EditableDraft>) {
    setDrafts((current) => ({ ...current, [itemId]: { ...current[itemId], ...patch } }));
  }

  const rescan = useCallback(async (options?: { silent?: boolean }) => {
    if (rescanLockRef.current) {
      return;
    }

    rescanLockRef.current = true;
    resetCountdown();
    if (!options?.silent) {
      setLoading(true);
      setMessage('');
      setError('');
    }

    try {
      const response = await fetch('/api/admin/v1/alerts/feishu/discovery/scan', { method: 'POST' });
      const payload = (await response.json().catch(() => ({}))) as MutationPayload;
      if (!response.ok || payload.ok === false || !payload.data) {
        throw new Error(payload.error || '扫描失败');
      }
      applySnapshot(payload.data, options?.silent ? undefined : `扫描完成，发现 ${payload.data.items.length} 条飞书机器人通道。`);
    } catch (scanError) {
      if (!options?.silent) {
        setError(scanError instanceof Error ? scanError.message : '扫描失败');
      }
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
      rescanLockRef.current = false;
    }
  }, [applySnapshot, resetCountdown]);

  useEffect(() => {
    if (autoRefreshPaused) {
      return;
    }

    resetCountdown();

    const countdownTimer = window.setInterval(() => {
      setCountdownSeconds((current) => (current > 1 ? current - 1 : AUTO_RESCAN_SECONDS));
    }, 1000);

    const rescanTimer = window.setInterval(() => {
      resetCountdown();
      void rescan({ silent: true });
    }, AUTO_RESCAN_MS);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearInterval(rescanTimer);
    };
  }, [autoRefreshPaused, rescan, resetCountdown]);

  async function saveItem(item: FeishuDiscoveredChannel) {
    if (!isEditable(item)) return;
    const draft = drafts[item.id] || createDraft(item);

    setSavingId(item.id);
    setMessage('');
    setError('');

    try {
      const body = item.kind === 'group-binding'
        ? {
            kind: 'group-binding',
            peerId: item.peerId,
            agentId: draft.agentId,
            enabled: draft.enabled,
            requireMention: draft.requireMention
          }
        : {
            kind: 'dm-binding',
            peerId: item.peerId,
            agentId: draft.agentId,
            enabled: draft.enabled,
            bindingKind: draft.bindingKind
          };

      const response = await fetch('/api/admin/v1/alerts/feishu/bindings/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = (await response.json().catch(() => ({}))) as MutationPayload;
      if (!response.ok || payload.ok === false || !payload.data) {
        throw new Error(payload.error || '保存失败');
      }

      applySnapshot(payload.data, payload.message || '保存成功');
      resetCountdown();
      setEditingId('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败');
    } finally {
      setSavingId('');
    }
  }

  async function deleteItem(item: FeishuDiscoveredChannel) {
    if (!isEditable(item) || !item.peerId) return;
    if (!window.confirm(`确认删除 ${item.title} 吗？这会直接改 live openclaw.json。`)) {
      return;
    }

    setDeletingId(item.id);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/admin/v1/alerts/feishu/bindings/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: item.kind, peerId: item.peerId })
      });
      const payload = (await response.json().catch(() => ({}))) as MutationPayload;
      if (!response.ok || payload.ok === false || !payload.data) {
        throw new Error(payload.error || '删除失败');
      }

      applySnapshot(payload.data, payload.message || '删除成功');
      resetCountdown();
      setEditingId('');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败');
    } finally {
      setDeletingId('');
    }
  }

  return (
    <section className="surface-panel overflow-hidden p-5 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="page-eyebrow">Feishu Discovery</div>
          <h2 className="mt-3 text-[1.45rem] font-semibold tracking-tight text-slate-900 md:text-[1.7rem]">自动发现现有飞书机器人通道，并直接纳入后台视图。</h2>
          <p className="mt-2 max-w-3xl text-[14px] leading-6 text-slate-600">
            这里会读取 live `openclaw.json` 里的 `channels.feishu`、账号、群绑定和私聊绑定；发现后可以直接编辑路由，绿色闪烁代表最近 3 分钟内收到了消息。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="pill-badge">最近扫描：{formatScannedAt(snapshot.scannedAt)}</span>
          <span className="pill-badge">活跃通道：{activeCount}</span>
          <span className={`pill-badge ${autoRefreshPaused ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-sky-200 bg-sky-50 text-sky-700'}`}>
            {autoRefreshPaused ? '自动刷新已暂停' : `${countdownSeconds} 秒后刷新`}
          </span>
          <button type="button" onClick={() => void rescan()} disabled={loading} className="btn-secondary px-5 py-2 text-sm">
            {loading ? '扫描中…' : '重新扫描'}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="text-sm font-medium text-slate-500">告警 Webhook</div>
          <div className="mt-3 text-[1.8rem] font-semibold tracking-tight text-slate-900">{snapshot.managedAlertChannels}</div>
          <div className="mt-2 text-sm leading-6 text-slate-500">已纳管的告警通道</div>
        </div>
        <div className="metric-card">
          <div className="text-sm font-medium text-slate-500">机器人账号</div>
          <div className="mt-3 text-[1.8rem] font-semibold tracking-tight text-slate-900">{snapshot.botAccounts}</div>
          <div className="mt-2 text-sm leading-6 text-slate-500">来自 live Feishu 配置</div>
        </div>
        <div className="metric-card">
          <div className="text-sm font-medium text-slate-500">群绑定</div>
          <div className="mt-3 text-[1.8rem] font-semibold tracking-tight text-slate-900">{snapshot.groupBindings}</div>
          <div className="mt-2 text-sm leading-6 text-slate-500">群聊 → Agent 路由</div>
        </div>
        <div className="metric-card">
          <div className="text-sm font-medium text-slate-500">私聊绑定</div>
          <div className="mt-3 text-[1.8rem] font-semibold tracking-tight text-slate-900">{snapshot.dmBindings}</div>
          <div className="mt-2 text-sm leading-6 text-slate-500">含私聊用户路由</div>
        </div>
      </div>

      <div className="mt-4 rounded-[20px] border border-sky-100 bg-sky-50/70 px-4 py-4 text-[13px] leading-6 text-slate-600">
        说明：闪烁绿点表示通道最近 3 分钟内有消息流入；页面每 20 秒自动扫描一次，右侧活动消息会做滚动展示；编辑某条绑定时会自动暂停；保存或删除会直接写入 live `openclaw.json`，如果网关没马上刷新，可去“服务控制”页重启 `openclaw-gateway`。
      </div>

      <div className="mt-5 space-y-3">
        {snapshot.items.length ? snapshot.items.map((item) => {
          const draft = drafts[item.id] || createDraft(item);
          const open = expanded[item.id];
          const editable = isEditable(item);
          const editing = editingId === item.id;
          const messages = item.recentMessages || [];
          const showPreview = item.active || messages.length > 0;
          const tickerMessages = previewFeed(messages);

          return (
            <div key={item.id} className={`rounded-[20px] border px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition ${item.active ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white/90'}`}>
              <div className={`grid gap-5 ${showPreview ? 'xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start' : ''}`}>
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`activity-signal ${item.active ? 'is-active' : 'is-idle'}`} aria-hidden="true" />
                        <div className="text-base font-semibold tracking-tight text-slate-900">{item.title}</div>
                      </div>
                      <div className="mt-1 text-[13px] leading-6 text-slate-600">{item.subtitle}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(item.status)}`}>{item.status === 'managed' ? '已纳管' : '需关注'}</span>
                      <span className="pill-badge">{kindLabel(item.kind)}</span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${item.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                        {item.active ? '活动中' : '静默中'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.metadata.map((meta) => (
                      <span key={`${item.id}:${meta}`} className="pill-badge">{meta}</span>
                    ))}
                    {item.lastActivityAt ? <span className="pill-badge">最近消息：{formatScannedAt(item.lastActivityAt)}</span> : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setExpanded((current) => ({ ...current, [item.id]: !current[item.id] }))} className="btn-secondary px-4 py-2 text-sm">
                      {open ? '收起详情' : '查看详情'}
                    </button>
                    {item.agentId ? <Link href={`/models/bindings?agent=${encodeURIComponent(item.agentId)}`} className="btn-secondary px-4 py-2 text-sm">跳到 Agent 绑定</Link> : null}
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => {
                          setExpanded((current) => ({ ...current, [item.id]: true }));
                          setEditingId((current) => current === item.id ? '' : item.id);
                        }}
                        className="btn-secondary px-4 py-2 text-sm"
                      >
                        {editing ? '收起编辑' : '编辑绑定'}
                      </button>
                    ) : null}
                    {editable ? (
                      <button type="button" onClick={() => void deleteItem(item)} disabled={deletingId === item.id} className="btn-danger px-4 py-2 text-sm">
                        {deletingId === item.id ? '删除中…' : '删除绑定'}
                      </button>
                    ) : null}
                  </div>

                  {item.bindingKind === 'p2p' ? <div className="notice-error mt-4">检测到旧版 `p2p` 绑定，建议修成 `direct` 或 `dm`，避免 Gateway 启动或升级时出现兼容问题。</div> : null}

                  {open ? (
                    <div className="surface-soft mt-4 p-4">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {detailRows(item).map((row) => (
                          <div key={`${item.id}:${row.label}`}>
                            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{row.label}</div>
                            <div className="mt-2 text-sm font-medium text-slate-700">{row.value}</div>
                          </div>
                        ))}
                      </div>

                      {editing && editable ? (
                        <div className="mt-4 border-t border-slate-200/80 pt-4">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <label>
                              <span className="field-label">绑定 Agent</span>
                              <input value={draft.agentId} onChange={(event) => updateDraft(item.id, { agentId: event.target.value })} className="field" placeholder="例如 default / backend / frontend" />
                            </label>

                            {item.kind === 'dm-binding' ? (
                              <label>
                                <span className="field-label">私聊路由类型</span>
                                <select value={draft.bindingKind} onChange={(event) => updateDraft(item.id, { bindingKind: event.target.value as EditableDraft['bindingKind'] })} className="field">
                                  <option value="direct">direct</option>
                                  <option value="dm">dm</option>
                                </select>
                              </label>
                            ) : (
                              <div className="flex items-end">
                                <div className="rounded-[20px] border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-500">群 ID / 用户 ID 仍使用当前发现值，避免误改 live 路由入口。</div>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-600">
                            <label className="inline-flex items-center gap-2">
                              <input type="checkbox" checked={draft.enabled} onChange={(event) => updateDraft(item.id, { enabled: event.target.checked })} />
                              <span>{item.kind === 'group-binding' ? '启用群路由' : '加入私聊白名单'}</span>
                            </label>
                            {item.kind === 'group-binding' ? (
                              <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={draft.requireMention} onChange={(event) => updateDraft(item.id, { requireMention: event.target.checked })} />
                                <span>要求 @ 机器人</span>
                              </label>
                            ) : null}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button type="button" onClick={() => void saveItem(item)} disabled={savingId === item.id} className="btn-primary px-5 py-2 text-sm">
                              {savingId === item.id ? '保存中…' : '保存修改'}
                            </button>
                            <button type="button" onClick={() => setEditingId('')} className="btn-secondary px-5 py-2 text-sm">取消</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {showPreview ? (
                  <div className={`activity-preview-panel ${item.active ? 'is-live' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">活动消息</div>
                      <span className="pill-badge border-white/70 bg-white/70 text-slate-500">实时消息</span>
                    </div>
                    {tickerMessages.length ? (
                      <div className="activity-ticker-window mt-4">
                        <div className="activity-ticker-track" style={createTickerStyle(messages.length, Boolean(item.active))}>
                          {tickerMessages.map((activityMessage, index) => (
                            <div key={`${item.id}:${activityMessage.occurredAt}:${index}`} className="activity-ticker-line">
                              <div className="text-sm font-medium leading-6 text-slate-700">{activityMessage.text}</div>
                              <div className="mt-2 text-xs tracking-wide text-slate-400">{formatScannedAt(activityMessage.occurredAt)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-[18px] border border-dashed border-slate-200 bg-white/60 px-4 py-5 text-sm leading-7 text-slate-500">
                        最近有活动，但当前日志里还没捕获到可展示的消息正文。
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          );
        }) : <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">当前没有从 live 配置里发现可展示的飞书机器人通道。</div>}
      </div>

      {message ? <div className="notice-success mt-4">{message}</div> : null}
      {error ? <div className="notice-error mt-4">{error}</div> : null}
    </section>
  );
}

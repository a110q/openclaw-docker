"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

type RuntimeSyncStatus = 'pending' | 'synced' | 'failed';

type ChatTarget = {
  id: string;
  name: string;
  archetype: string;
  modelRef: string;
  runtimeSyncStatus: RuntimeSyncStatus;
  runtimeAgentId?: string;
  runtimeAgentNumericId?: number;
  runtimeConversationId?: number;
  runtimeConversationUrl?: string;
};

type RuntimeConversationEntry = {
  id: number;
  lobsterId?: string;
  lobsterName?: string;
  agentKey?: string;
  displayTitle: string;
  instanceName?: string;
  agentDisplayName?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  lastMessageStatus?: string;
  dialogueStatus?: string;
  directAgentId?: number;
  directInstanceId?: number;
  createdAt: string;
  updatedAt: string;
  externalUrl: string;
};

type RuntimeConversationMessage = {
  id: string;
  conversationId: number;
  senderType: string;
  senderLabel: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type RuntimeConversationDispatch = {
  id: string;
  messageId: string;
  conversationId: number;
  instanceId: number;
  agentId: number;
  dispatchMode: string;
  status: string;
  errorMessage?: string;
  sessionKey?: string;
  createdAt: string;
  updatedAt: string;
};

type RuntimeConversationDetail = {
  lobsterId?: string;
  lobsterName?: string;
  agentKey?: string;
  conversationId: number;
  displayTitle: string;
  externalUrl: string;
  messages: RuntimeConversationMessage[];
  dispatches: RuntimeConversationDispatch[];
  directAgentId?: number;
  directInstanceId?: number;
  updatedAt: string;
};

type ChatWorkspace = {
  targets: ChatTarget[];
  selectedLobsterId?: string;
  recentConversations: RuntimeConversationEntry[];
  currentConversation: RuntimeConversationDetail | null;
};

type LocalChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  status?: string;
};

type ViewMessage = {
  id: string;
  alignment: 'user' | 'assistant';
  senderLabel: string;
  content: string;
  createdAt: string;
  status?: string;
  mode: 'runtime' | 'local';
};

const LOCAL_STORAGE_KEY = 'openclaw-platform-chat-local-v2';

function formatTime(value?: string) {
  if (!value) return '刚刚';
  try {
    return new Date(value).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return value;
  }
}

function buildModeBadgeClass(status: RuntimeSyncStatus) {
  if (status === 'synced') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'failed') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

function buildModeLabel(status: RuntimeSyncStatus) {
  if (status === 'synced') return '运行时模式';
  if (status === 'failed') return '本地模式';
  return '准备中';
}

function isRuntimeTarget(target?: ChatTarget | null) {
  return target?.runtimeSyncStatus === 'synced';
}

function readLocalConversationCache() {
  if (typeof window === 'undefined') return {} as Record<string, LocalChatMessage[]>;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {} as Record<string, LocalChatMessage[]>;
    const parsed = JSON.parse(raw) as Record<string, LocalChatMessage[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {} as Record<string, LocalChatMessage[]>;
  }
}

export function PlatformChatConsole({
  initialWorkspace,
  showIntermediateMessages,
}: {
  initialWorkspace: ChatWorkspace;
  showIntermediateMessages: boolean;
}) {
  const [targets, setTargets] = useState<ChatTarget[]>(initialWorkspace.targets);
  const [selectedLobsterId, setSelectedLobsterId] = useState(initialWorkspace.selectedLobsterId || initialWorkspace.targets[0]?.id || '');
  const [recentConversations, setRecentConversations] = useState<RuntimeConversationEntry[]>(initialWorkspace.recentConversations);
  const [runtimeConversation, setRuntimeConversation] = useState<RuntimeConversationDetail | null>(initialWorkspace.currentConversation);
  const [localConversations, setLocalConversations] = useState<Record<string, LocalChatMessage[]>>(() =>
    Object.fromEntries(initialWorkspace.targets.map((item) => [item.id, []])),
  );
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fetchTokenRef = useRef(0);

  const selectedTarget = useMemo(
    () => targets.find((item) => item.id === selectedLobsterId) || null,
    [targets, selectedLobsterId],
  );

  const latestDispatch = runtimeConversation?.dispatches.at(-1);
  const runtimeActive = isRuntimeTarget(selectedTarget);

  const viewMessages = useMemo<ViewMessage[]>(() => {
    if (runtimeActive) {
      return (runtimeConversation?.messages || []).map((message) => ({
        id: message.id,
        alignment: message.senderType === 'user' ? 'user' : 'assistant',
        senderLabel: message.senderType === 'user' ? '我' : message.senderLabel || selectedTarget?.name || '龙虾',
        content: message.content,
        createdAt: message.createdAt,
        status: message.status,
        mode: 'runtime',
      }));
    }

    return (localConversations[selectedLobsterId] || []).map((message) => ({
      id: message.id,
      alignment: message.role,
      senderLabel: message.role === 'user' ? '我' : selectedTarget?.name || '龙虾',
      content: message.content,
      createdAt: message.createdAt,
      status: message.status,
      mode: 'local',
    }));
  }, [localConversations, runtimeActive, runtimeConversation, selectedLobsterId, selectedTarget?.name]);

  useEffect(() => {
    const cached = readLocalConversationCache();
    setLocalConversations((current) => ({
      ...Object.fromEntries(targets.map((item) => [item.id, cached[item.id] || current[item.id] || []])),
      ...current,
      ...cached,
    }));
  }, [targets]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localConversations));
  }, [localConversations]);

  useEffect(() => {
    if (!selectedTarget || !runtimeActive) {
      return;
    }
    if (runtimeConversation?.lobsterId === selectedTarget.id) {
      return;
    }

    void loadRuntimeConversation(selectedTarget.id);
  }, [runtimeActive, runtimeConversation?.lobsterId, selectedTarget]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [viewMessages.length, selectedLobsterId]);

  async function loadRuntimeConversation(lobsterId: string) {
    const requestId = ++fetchTokenRef.current;
    setRefreshing(true);
    setError('');

    try {
      const response = await fetch(`/api/platform/v1/swarm/chat?lobsterId=${encodeURIComponent(lobsterId)}`, {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        currentConversation?: RuntimeConversationDetail | null;
        recentConversations?: RuntimeConversationEntry[];
        error?: string;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || '读取运行时会话失败');
      }
      if (requestId !== fetchTokenRef.current) return;

      setRecentConversations(payload.recentConversations || []);
      setRuntimeConversation(payload.currentConversation || null);
      if (payload.currentConversation) {
        patchTargetConversation(payload.currentConversation);
      }
    } catch (fetchError) {
      if (requestId !== fetchTokenRef.current) return;
      setError(fetchError instanceof Error ? fetchError.message : '读取运行时会话失败');
    } finally {
      if (requestId === fetchTokenRef.current) {
        setRefreshing(false);
      }
    }
  }

  function patchTargetConversation(conversation: RuntimeConversationDetail) {
    setTargets((current) =>
      current.map((item) =>
        item.id === conversation.lobsterId
          ? {
              ...item,
              runtimeConversationId: conversation.conversationId,
              runtimeConversationUrl: conversation.externalUrl,
            }
          : item,
      ),
    );
  }

  async function sendMessage() {
    if (!selectedTarget || !draft.trim() || loading) {
      return;
    }

    const content = draft.trim();
    setDraft('');
    setError('');
    setLoading(true);

    if (runtimeActive) {
      try {
        const response = await fetch('/api/platform/v1/swarm/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lobsterId: selectedTarget.id,
            content,
          }),
        });
        const payload = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          currentConversation?: RuntimeConversationDetail | null;
          recentConversations?: RuntimeConversationEntry[];
          error?: string;
        };

        if (!response.ok || !payload.ok || !payload.currentConversation) {
          throw new Error(payload.error || '发送运行时消息失败');
        }

        setRuntimeConversation(payload.currentConversation);
        setRecentConversations(payload.recentConversations || []);
        patchTargetConversation(payload.currentConversation);
      } catch (submitError) {
        setDraft(content);
        setError(submitError instanceof Error ? submitError.message : '发送运行时消息失败');
      } finally {
        setLoading(false);
      }
      return;
    }

    const nextUserMessage: LocalChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      status: 'completed',
    };
    const currentMessages = localConversations[selectedTarget.id] || [];
    const nextMessages = [...currentMessages, nextUserMessage];
    setLocalConversations((current) => ({
      ...current,
      [selectedTarget.id]: nextMessages,
    }));

    try {
      const response = await fetch('/api/platform/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobsterId: selectedTarget.id,
          messages: nextMessages.map((item) => ({
            role: item.role,
            content: item.content,
          })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        content?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.content) {
        throw new Error(payload.error || '本地模式对话失败');
      }

      setLocalConversations((current) => ({
        ...current,
        [selectedTarget.id]: [
          ...(current[selectedTarget.id] || nextMessages),
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: payload.content || '',
            createdAt: new Date().toISOString(),
            status: 'completed',
          },
        ],
      }));
    } catch (submitError) {
      setLocalConversations((current) => ({
        ...current,
        [selectedTarget.id]: currentMessages,
      }));
      setDraft(content);
      setError(submitError instanceof Error ? submitError.message : '本地模式对话失败');
    } finally {
      setLoading(false);
    }
  }

  if (!targets.length) {
    return (
      <section className="surface-panel px-5 py-5 md:px-6">
        <div className="page-eyebrow">Chat Console</div>
        <h2 className="mt-2 text-[1.48rem] font-semibold tracking-tight text-slate-900">对话台</h2>
        <div className="mt-4 surface-soft px-4 py-5 text-[13px] leading-6 text-slate-600">
          你还没有龙虾。先去“我的龙虾”创建一只，才能开始聊天与使用它。
        </div>
      </section>
    );
  }

  return (
    <section className="mt-4 grid gap-4 2xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <aside className="surface-panel px-4 py-4 md:px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="page-eyebrow">My Lobsters</div>
            <h2 className="mt-2 text-[1.3rem] font-semibold tracking-tight text-slate-900">选择聊天对象</h2>
          </div>
          <span className="pill-badge">{targets.length} 只</span>
        </div>

        <div className="mt-4 space-y-3">
          {targets.map((lobster) => {
            const active = lobster.id === selectedLobsterId;
            return (
              <button
                key={lobster.id}
                type="button"
                onClick={() => {
                  setSelectedLobsterId(lobster.id);
                  setError('');
                }}
                className={[
                  'w-full rounded-[22px] border px-4 py-4 text-left transition',
                  active
                    ? 'border-sky-300 bg-[linear-gradient(180deg,rgba(240,249,255,0.95),rgba(255,255,255,0.98))] shadow-[0_18px_32px_-28px_rgba(14,116,144,0.28)]'
                    : 'border-slate-200 bg-white/96 hover:border-slate-300 hover:bg-slate-50/90',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{lobster.name}</div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${buildModeBadgeClass(lobster.runtimeSyncStatus)}`}>
                    {buildModeLabel(lobster.runtimeSyncStatus)}
                  </span>
                </div>
                <div className="mt-2 text-[13px] leading-6 text-slate-600">{lobster.archetype}</div>
                <div className="mt-2 truncate text-[12px] text-slate-500" title={lobster.modelRef}>{lobster.modelRef}</div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="surface-panel px-4 py-4 md:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="page-eyebrow">Conversation</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="min-w-0 flex-1 truncate text-[1.38rem] font-semibold tracking-tight text-slate-900">
                {selectedTarget?.name || '未选择龙虾'}
              </h2>
              {selectedTarget ? (
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${buildModeBadgeClass(selectedTarget.runtimeSyncStatus)}`}>
                  {buildModeLabel(selectedTarget.runtimeSyncStatus)}
                </span>
              ) : null}
              {showIntermediateMessages ? (
                <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">显示中间过程</span>
              ) : null}
            </div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">
              {runtimeActive
                ? '当前已接入 ClawSwarm direct conversation，消息写入运行时，会话刷新后仍然保留。'
                : '当前使用平台本地模式，适合未同步或临时调试场景；消息会保存在当前浏览器。'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {refreshing ? <span className="pill-badge">读取中…</span> : null}
            {runtimeConversation?.externalUrl ? (
              <a
                href={runtimeConversation.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary px-4 py-2 text-xs"
              >
                打开 ClawSwarm 原页
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
          <div className="rounded-[26px] border border-slate-200 bg-white/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div ref={viewportRef} className="flex h-[58vh] min-h-[420px] flex-col gap-3 overflow-y-auto pr-1">
              {viewMessages.length ? (
                viewMessages.map((message) => (
                  <div
                    key={message.id}
                    className={[
                      'max-w-[88%] rounded-[22px] px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]',
                      message.alignment === 'user'
                        ? 'ml-auto border border-sky-200 bg-sky-50 text-slate-900'
                        : 'border border-slate-200 bg-slate-50/88 text-slate-700',
                    ].join(' ')}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="font-medium text-slate-700">{message.senderLabel}</span>
                      <span>{formatTime(message.createdAt)}</span>
                      {message.status ? <span>{message.status}</span> : null}
                      <span>{message.mode === 'runtime' ? 'runtime' : 'local'}</span>
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.content}</div>
                  </div>
                ))
              ) : (
                <div className="surface-soft flex min-h-[180px] items-center px-4 py-5 text-[13px] leading-6 text-slate-600">
                  {runtimeActive
                    ? '这只龙虾还没有运行时消息。直接发送第一条消息，平台会为你创建 direct conversation。'
                    : '这只龙虾当前走本地模式。发送一条消息后，聊天记录会保存到当前浏览器。'}
                </div>
              )}
            </div>

            {error ? <div className="notice-error mt-4">{error}</div> : null}

            <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50/88 p-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                className="field min-h-[110px] resize-none border-0 bg-white/96"
                placeholder={runtimeActive ? '给这只龙虾发送运行时消息，Cmd/Ctrl + Enter 快速发送…' : '给这只龙虾发一条本地消息，消息会保存在当前浏览器…'}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[12px] text-slate-500">
                  {runtimeActive
                    ? '发送后会等待运行时回写结果。'
                    : '本地模式调用当前龙虾绑定的模型。'}
                </div>
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={loading || !draft.trim() || !selectedTarget}
                  className="btn-primary min-w-[132px] justify-center disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? '发送中…' : '发送消息'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="surface-soft px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">当前状态</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {runtimeActive ? '已连接到 ClawSwarm 运行时' : '使用平台本地聊天模式'}
              </div>
              <div className="mt-2 text-[12px] leading-6 text-slate-600">
                {selectedTarget?.modelRef || '暂无模型'}
              </div>
              {runtimeConversation?.conversationId ? (
                <div className="mt-2 text-[12px] text-slate-500">会话 ID · {runtimeConversation.conversationId}</div>
              ) : null}
            </div>

            {latestDispatch ? (
              <div className="surface-soft px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">最近派发</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">{latestDispatch.dispatchMode}</span>
                  <span className="pill-badge">{latestDispatch.status}</span>
                </div>
                <div className="mt-2 text-[12px] leading-6 text-slate-600">
                  {latestDispatch.errorMessage || `实例 ${latestDispatch.instanceId} · Agent ${latestDispatch.agentId}`}
                </div>
              </div>
            ) : null}

            <div className="surface-panel px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="page-eyebrow">Recent Runtime Conversations</div>
                  <h3 className="mt-2 text-[1.02rem] font-semibold tracking-tight text-slate-900">最近会话</h3>
                </div>
                <span className="pill-badge">{recentConversations.length}</span>
              </div>

              <div className="mt-4 space-y-3">
                {recentConversations.length ? (
                  recentConversations.map((conversation) => {
                    const active = conversation.lobsterId === selectedLobsterId;
                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => {
                          if (conversation.lobsterId) {
                            setSelectedLobsterId(conversation.lobsterId);
                            setError('');
                          }
                        }}
                        className={[
                          'w-full rounded-[18px] border px-3 py-3 text-left transition',
                          active
                            ? 'border-sky-200 bg-sky-50/75'
                            : 'border-slate-200 bg-white/92 hover:border-slate-300 hover:bg-slate-50/88',
                        ].join(' ')}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                            {conversation.lobsterName || conversation.displayTitle}
                          </div>
                          {conversation.dialogueStatus ? <span className="pill-badge">{conversation.dialogueStatus}</span> : null}
                        </div>
                        <div className="mt-2 line-clamp-2 text-[12px] leading-5 text-slate-600">
                          {conversation.lastMessagePreview || '暂无预览'}
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500">
                          {formatTime(conversation.lastMessageAt || conversation.updatedAt)}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-[18px] border border-dashed border-slate-200 px-3 py-5 text-[12px] leading-6 text-slate-500">
                    当前用户名下还没有运行时会话。你可以先给已同步龙虾发一条消息，平台会自动创建 direct conversation。
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="surface-panel px-4 py-4 md:px-5">
        <div className="page-eyebrow">Usage Notes</div>
        <h2 className="mt-2 text-[1.14rem] font-semibold tracking-tight text-slate-900">使用说明</h2>
        <div className="mt-4 space-y-3 text-[13px] leading-6 text-slate-600">
          <div className="rounded-[18px] border border-slate-200 bg-white/90 px-4 py-4">
            已同步龙虾：真正接到 ClawSwarm 运行时，对应的消息会长期保留。
          </div>
          <div className="rounded-[18px] border border-slate-200 bg-white/90 px-4 py-4">
            未同步龙虾：走平台本地模式，聊天记录保存在当前浏览器，刷新也不会丢。
          </div>
          <div className="rounded-[18px] border border-slate-200 bg-white/90 px-4 py-4">
            如果你想查看原始运行时页面，可以点击“打开 ClawSwarm 原页”。
          </div>
        </div>
      </aside>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { SandboxContainerSummary } from '@/lib/types/admin';

type RuntimeFilter = 'all' | 'running' | 'limited' | 'orphan';
type ContainerAction = 'restart' | 'remove';

const FILTER_OPTIONS: Array<{ id: RuntimeFilter; label: string }> = [
  { id: 'all', label: '全部容器' },
  { id: 'running', label: '仅运行中' },
  { id: 'limited', label: '仅有限制' },
  { id: 'orphan', label: '未关联 Agent' },
];

function hasResourceLimits(item: SandboxContainerSummary) {
  return Boolean(
    (item.cpuLimit && item.cpuLimit !== '未限制') ||
      (item.memoryLimit && item.memoryLimit !== '未限制') ||
      item.pidsLimit,
  );
}

function statusMeta(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'running') {
    return {
      label: '运行中',
      badge: 'border-emerald-100 bg-emerald-50 text-emerald-700',
      dot: 'bg-emerald-500',
    };
  }
  if (normalized === 'exited' || normalized === 'stopped') {
    return {
      label: '已停止',
      badge: 'border-slate-200 bg-slate-50 text-slate-600',
      dot: 'bg-slate-300',
    };
  }
  if (normalized === 'restarting' || normalized === 'created') {
    return {
      label: '处理中',
      badge: 'border-amber-100 bg-amber-50 text-amber-700',
      dot: 'bg-amber-400',
    };
  }
  return {
    label: status || '未知',
    badge: 'border-rose-100 bg-rose-50 text-rose-700',
    dot: 'bg-rose-400',
  };
}

function formatTime(value?: string) {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

async function readSnapshot() {
  const response = await fetch('/api/admin/v1/system/sandbox-containers', {
    method: 'GET',
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: SandboxContainerSummary[];
    error?: string;
  };
  if (!response.ok || !payload.data) {
    throw new Error(payload.error || '读取沙箱容器失败');
  }
  return payload.data;
}

export function SandboxRuntimePanel({
  initialContainers,
}: {
  initialContainers: SandboxContainerSummary[];
}) {
  const [containers, setContainers] = useState(initialContainers);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RuntimeFilter>('all');
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const summary = useMemo(() => {
    const running = containers.filter((item) => item.status.toLowerCase() === 'running').length;
    const limited = containers.filter(hasResourceLimits).length;
    const orphan = containers.filter((item) => !item.agentId).length;
    const linkedAgents = new Set(containers.map((item) => item.agentId).filter(Boolean)).size;
    return { total: containers.length, running, limited, orphan, linkedAgents };
  }, [containers]);

  const filteredContainers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return containers.filter((item) => {
      if (filter === 'running' && item.status.toLowerCase() !== 'running') return false;
      if (filter === 'limited' && !hasResourceLimits(item)) return false;
      if (filter === 'orphan' && item.agentId) return false;
      if (!keyword) return true;
      return [item.name, item.agentId, item.shortId, item.networkMode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [containers, filter, query]);

  async function refreshSnapshot(showMessage = true) {
    setLoading(true);
    setError('');
    if (showMessage) setMessage('');
    try {
      const next = await readSnapshot();
      setContainers(next);
      if (showMessage) {
        setMessage(`已刷新容器视图，共 ${next.length} 个沙箱容器。`);
      }
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : '刷新失败');
    } finally {
      setLoading(false);
    }
  }

  async function runAction(containerName: string, action: ContainerAction) {
    const actionKey = `${action}:${containerName}`;
    setActiveAction(actionKey);
    setMessage('');
    setError('');

    try {
      const response = await fetch(`/api/admin/v1/system/sandbox-containers/${encodeURIComponent(containerName)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { ok?: boolean; name?: string };
        error?: string;
      };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || '容器动作执行失败');
      }

      if (action === 'remove') {
        setContainers((current) => current.filter((item) => item.name !== containerName));
        setMessage(`已移除容器 ${containerName}。如果对应 Agent 继续工作，会按当前策略重新拉起沙箱。`);
      } else {
        await refreshSnapshot(false);
        setMessage(`已重启容器 ${containerName}，当前视图已同步刷新。`);
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '容器动作执行失败');
    } finally {
      setActiveAction('');
    }
  }

  return (
    <section className="surface-panel p-5 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="page-eyebrow">Sandbox Runtime</div>
          <h2 className="mt-2 text-[1.42rem] font-semibold tracking-tight text-slate-900 md:text-[1.68rem]">
            把正在跑的沙箱容器，收成一张可刷新、可操作的实时运维视图。
          </h2>
          <p className="mt-2 max-w-4xl text-[13px] leading-6 text-slate-600">
            这里展示的不是静态配置，而是 Docker 当前真实存在的 Agent 沙箱容器。你可以先在
            <Link href="/agents" className="mx-1 text-sky-700 underline underline-offset-4">Agent 列表</Link>
            里配置目录和资源上限，再回到这里看有没有真正落到运行态；默认策略则放在
            <Link href="/settings" className="mx-1 text-sky-700 underline underline-offset-4">系统设置</Link>
            里统一管理。
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">容器 {summary.total}</span>
          <span className="pill-badge">运行中 {summary.running}</span>
          <span className="pill-badge">有限制 {summary.limited}</span>
          <button type="button" onClick={() => refreshSnapshot()} disabled={loading || Boolean(activeAction)} className="btn-secondary">
            {loading ? '刷新中…' : '刷新容器视图'}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card">
          <div className="text-[13px] font-medium text-slate-500">运行中容器</div>
          <div className="mt-2 text-[1.3rem] font-semibold tracking-tight text-slate-900">{summary.running}</div>
          <div className="mt-1 text-[13px] leading-6 text-slate-500">当前已启动并可承接 Agent 沙箱任务。</div>
        </div>
        <div className="metric-card">
          <div className="text-[13px] font-medium text-slate-500">有限制容器</div>
          <div className="mt-2 text-[1.3rem] font-semibold tracking-tight text-slate-900">{summary.limited}</div>
          <div className="mt-1 text-[13px] leading-6 text-slate-500">已带 CPU / 内存 / PIDs 等限制的运行实例。</div>
        </div>
        <div className="metric-card">
          <div className="text-[13px] font-medium text-slate-500">关联 Agent</div>
          <div className="mt-2 text-[1.3rem] font-semibold tracking-tight text-slate-900">{summary.linkedAgents}</div>
          <div className="mt-1 text-[13px] leading-6 text-slate-500">当前容器已映射到的 Agent 数量。</div>
        </div>
        <div className="metric-card">
          <div className="text-[13px] font-medium text-slate-500">游离容器</div>
          <div className="mt-2 text-[1.3rem] font-semibold tracking-tight text-slate-900">{summary.orphan}</div>
          <div className="mt-1 text-[13px] leading-6 text-slate-500">未识别出 Agent 归属，建议优先检查或清理。</div>
        </div>
      </div>

      <div className="console-toolbar mt-5 justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="field min-w-[220px] flex-1 bg-white"
            placeholder="搜索容器名 / Agent ID / 短 ID / 网络模式"
          />
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => {
              const active = filter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setFilter(option.id)}
                  className={[
                    'rounded-full px-3 py-2 text-xs font-medium transition-colors',
                    active
                      ? 'bg-sky-600 text-white shadow-[0_10px_20px_rgba(14,116,144,0.18)]'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-slate-900',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="text-[12px] leading-6 text-slate-500">
          当前显示 {filteredContainers.length} / {containers.length}
        </div>
      </div>

      {message ? <div className="notice-success mt-4">{message}</div> : null}
      {error ? <div className="notice-error mt-4">{error}</div> : null}

      {filteredContainers.length === 0 ? (
        <div className="surface-soft mt-5 px-5 py-5 text-[13px] leading-6 text-slate-600">
          当前没有匹配的沙箱容器。你可以先新建或运行 Agent，或者切回“全部容器”查看完整列表。
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {filteredContainers.map((item) => {
            const status = statusMeta(item.status);
            const limited = hasResourceLimits(item);
            const actionBusy = Boolean(activeAction);
            return (
              <div key={item.id} className="list-row">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
                      <div className="text-[15px] font-semibold tracking-tight text-slate-900">{item.name}</div>
                      <span className={`pill-badge ${status.badge}`}>{status.label}</span>
                      <span className="pill-badge">短 ID {item.shortId || '未知'}</span>
                      {item.agentId ? (
                        <span className="pill-badge border-sky-100 bg-sky-50 text-sky-700">Agent {item.agentId}</span>
                      ) : (
                        <span className="pill-badge border-amber-100 bg-amber-50 text-amber-700">未关联 Agent</span>
                      )}
                      {limited ? (
                        <span className="pill-badge border-emerald-100 bg-emerald-50 text-emerald-700">已生效资源限制</span>
                      ) : (
                        <span className="pill-badge">当前未限制资源</span>
                      )}
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                      <div className="surface-soft px-4 py-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">即时资源</div>
                        <div className="mt-2 text-sm font-medium leading-6 text-slate-900">
                          CPU {item.cpuUsage || '—'} · 内存 {item.memoryUsage || '—'}
                        </div>
                        <div className="mt-1 text-[12px] leading-5 text-slate-500">来自 Docker 实时统计。</div>
                      </div>
                      <div className="surface-soft px-4 py-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">资源上限</div>
                        <div className="mt-2 text-sm font-medium leading-6 text-slate-900">
                          CPU {item.cpuLimit || '未限制'} · 内存 {item.memoryLimit || '未限制'}
                        </div>
                        <div className="mt-1 text-[12px] leading-5 text-slate-500">PIDs {item.pidsLimit ?? '未限制'}</div>
                      </div>
                      <div className="surface-soft px-4 py-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">网络与会话</div>
                        <div className="mt-2 text-sm font-medium leading-6 text-slate-900">网络 {item.networkMode || '默认'}</div>
                        <div className="mt-1 break-all text-[12px] leading-5 text-slate-500">会话 {item.sessionKey || '未记录 sessionKey'}</div>
                      </div>
                      <div className="surface-soft px-4 py-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">创建时间</div>
                        <div className="mt-2 text-sm font-medium leading-6 text-slate-900">{formatTime(item.createdAt)}</div>
                        <div className="mt-1 text-[12px] leading-5 text-slate-500">如果限制没落下，优先回 Agent 配置页重建。</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 xl:w-[220px] xl:flex-col xl:items-stretch">
                    <button
                      type="button"
                      onClick={() => runAction(item.name, 'restart')}
                      disabled={actionBusy}
                      className="btn-secondary w-full justify-center"
                    >
                      {activeAction === `restart:${item.name}` ? '重启中…' : '重启容器'}
                    </button>
                    <button
                      type="button"
                      onClick={() => runAction(item.name, 'remove')}
                      disabled={actionBusy}
                      className="btn-danger w-full justify-center"
                    >
                      {activeAction === `remove:${item.name}` ? '移除中…' : '移除容器'}
                    </button>
                    <div className="rounded-[18px] border border-slate-200/90 bg-slate-50/80 px-3 py-3 text-[12px] leading-6 text-slate-500">
                      删除 Agent 时，后台也会同步尝试清理它对应的沙箱容器；这里保留手动兜底入口。
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

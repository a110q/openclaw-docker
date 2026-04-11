"use client";

import { useMemo, useState } from "react";

const DEFAULTS = {
  workspaceRoot: "openclaw/workspace/agents",
  agentDirRoot: "openclaw/agents",
};

function normalizePath(value: string) {
  return value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function previewAbsolute(hostDataRoot: string, relativePath: string) {
  const normalizedRoot = hostDataRoot.replace(/\/+$/g, "");
  const normalizedRelative = normalizePath(relativePath);
  return normalizedRelative ? `${normalizedRoot}/${normalizedRelative}` : normalizedRoot;
}

export function AgentStoragePanel({
  initialSettings,
  initialResolved,
}: {
  initialSettings: {
    workspaceRoot: string;
    agentDirRoot: string;
  };
  initialResolved: {
    hostDataRoot: string;
    workspaceRootAbsolute: string;
    agentDirRootAbsolute: string;
  };
}) {
  const [form, setForm] = useState(initialSettings);
  const [resolved, setResolved] = useState(initialResolved);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const preview = useMemo(
    () => ({
      workspaceRootAbsolute: previewAbsolute(resolved.hostDataRoot, form.workspaceRoot),
      agentDirRootAbsolute: previewAbsolute(resolved.hostDataRoot, form.agentDirRoot),
    }),
    [form.agentDirRoot, form.workspaceRoot, resolved.hostDataRoot],
  );

  async function handleSave() {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/v1/platform/agent-storage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: {
          settings: typeof form;
          resolved: typeof resolved;
        };
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "保存 Agent 存储目录失败");
      }
      setForm(payload.data.settings);
      setResolved(payload.data.resolved);
      setMessage("已保存。新建 / 批量创建 / 扫描导入 / Agent 包导入会使用新的目录规则。");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="surface-panel p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="page-eyebrow">Agent Storage</div>
          <h2 className="mt-2 text-[1.45rem] font-semibold tracking-tight text-slate-900">
            Agent 数据目录
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            只配置 `OPENCLAW_HOST_DATA_ROOT` 下的相对路径，便于 Docker 挂载稳定和平台迁移。
          </p>
        </div>
        <span className="pill-badge">Docker Ready</span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <label className="block">
            <span className="field-label">Workspace 根目录（相对路径）</span>
            <input
              value={form.workspaceRoot}
              onChange={(event) =>
                setForm((current) => ({ ...current, workspaceRoot: event.target.value }))
              }
              className="field"
              placeholder={DEFAULTS.workspaceRoot}
            />
          </label>

          <label className="block">
            <span className="field-label">Agent 配置根目录（相对路径）</span>
            <input
              value={form.agentDirRoot}
              onChange={(event) =>
                setForm((current) => ({ ...current, agentDirRoot: event.target.value }))
              }
              className="field"
              placeholder={DEFAULTS.agentDirRoot}
            />
          </label>

          <div className="rounded-[20px] border border-amber-200/80 bg-amber-50/80 px-4 py-4 text-[13px] leading-6 text-slate-600">
            只支持相对路径；不要填绝对路径，也不要写 `..`。现有 Agent 的显式路径不会被强制改写，新的创建/导入/扫描结果才会按这里落盘。
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="btn-primary px-4 py-2 text-sm"
            >
              {loading ? "保存中…" : "保存目录设置"}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(DEFAULTS);
                setMessage("");
                setError("");
              }}
              disabled={loading}
              className="btn-secondary px-4 py-2 text-sm"
            >
              恢复默认值
            </button>
          </div>

          {message ? <div className="notice-success">{message}</div> : null}
          {error ? <div className="notice-error">{error}</div> : null}
        </div>

        <div className="space-y-3">
          <div className="surface-soft px-4 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Host Root
            </div>
            <div className="mt-2 break-all text-sm font-medium text-slate-900">
              {resolved.hostDataRoot}
            </div>
          </div>
          <div className="surface-soft px-4 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              当前生效 Workspace
            </div>
            <div className="mt-2 break-all font-mono text-[12px] text-slate-700">
              {resolved.workspaceRootAbsolute}
            </div>
          </div>
          <div className="surface-soft px-4 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              当前生效 Agent Dir
            </div>
            <div className="mt-2 break-all font-mono text-[12px] text-slate-700">
              {resolved.agentDirRootAbsolute}
            </div>
          </div>
          <div className="surface-soft px-4 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              保存后预览
            </div>
            <div className="mt-2 space-y-2 font-mono text-[12px] text-slate-700">
              <div>{preview.workspaceRootAbsolute}</div>
              <div>{preview.agentDirRootAbsolute}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

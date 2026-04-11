"use client";

import { useMemo, useState } from "react";

type SandboxPolicyForm = {
  cpus: string;
  memory: string;
  memorySwap: string;
  pidsLimit: string;
};

function toForm(input: {
  cpus?: number;
  memory?: string;
  memorySwap?: string;
  pidsLimit?: number;
}): SandboxPolicyForm {
  return {
    cpus: input.cpus != null ? String(input.cpus) : "",
    memory: input.memory || "",
    memorySwap: input.memorySwap || "",
    pidsLimit: input.pidsLimit != null ? String(input.pidsLimit) : "",
  };
}

function summarize(form: SandboxPolicyForm) {
  return [
    form.cpus ? `CPU ${form.cpus}` : "CPU 未限制",
    form.memory ? `内存 ${form.memory}` : "内存 未限制",
    form.memorySwap ? `Swap ${form.memorySwap}` : "Swap 未限制",
    form.pidsLimit ? `PIDs ${form.pidsLimit}` : "PIDs 未限制",
  ].join(" · ");
}

export function SandboxResourcePolicyPanel({
  initialPolicy,
}: {
  initialPolicy: {
    cpus?: number;
    memory?: string;
    memorySwap?: string;
    pidsLimit?: number;
  };
}) {
  const [form, setForm] = useState<SandboxPolicyForm>(toForm(initialPolicy));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const preview = useMemo(() => summarize(form), [form]);

  async function handleSave() {
    setLoading(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/v1/platform/sandbox-policy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cpus: form.cpus || undefined,
          memory: form.memory || undefined,
          memorySwap: form.memorySwap || undefined,
          pidsLimit: form.pidsLimit || undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        data?: {
          policy: typeof initialPolicy;
          appliedContainers?: number;
          clearedKeys?: string[];
        };
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "保存默认沙箱策略失败");
      }
      setForm(toForm(payload.data.policy));
      const clearNotice = payload.data.clearedKeys?.length
        ? `；其中 ${payload.data.clearedKeys.join(" / ")} 的“取消限制”会在下次沙箱重建后完全生效`
        : "";
      setMessage(
        `已保存默认策略，并尝试在线下发到 ${payload.data.appliedContainers || 0} 个运行中的继承型沙箱容器${clearNotice}`,
      );
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
          <div className="page-eyebrow">Sandbox Policy</div>
          <h2 className="mt-2 text-[1.45rem] font-semibold tracking-tight text-slate-900">
            默认沙箱资源策略
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            给未单独覆盖的 Agent 一个统一上限，避免沙箱容器无限制吃满宿主机内存和 CPU。
          </p>
        </div>
        <span className="pill-badge">Docker Sandbox</span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="field-label">CPU 上限</span>
            <input
              value={form.cpus}
              onChange={(event) =>
                setForm((current) => ({ ...current, cpus: event.target.value }))
              }
              className="field"
              placeholder="例如：1 / 1.5 / 2"
            />
          </label>

          <label className="block">
            <span className="field-label">内存上限</span>
            <input
              value={form.memory}
              onChange={(event) =>
                setForm((current) => ({ ...current, memory: event.target.value }))
              }
              className="field"
              placeholder="例如：512m / 1g"
            />
          </label>

          <label className="block">
            <span className="field-label">交换内存</span>
            <input
              value={form.memorySwap}
              onChange={(event) =>
                setForm((current) => ({ ...current, memorySwap: event.target.value }))
              }
              className="field"
              placeholder="例如：1g / 2g / -1"
            />
          </label>

          <label className="block">
            <span className="field-label">PIDs 上限</span>
            <input
              value={form.pidsLimit}
              onChange={(event) =>
                setForm((current) => ({ ...current, pidsLimit: event.target.value }))
              }
              className="field"
              placeholder="例如：256"
            />
          </label>

          <div className="md:col-span-2 rounded-[20px] border border-amber-200/80 bg-amber-50/80 px-4 py-4 text-[13px] leading-6 text-slate-600">
            留空表示不额外限制；这里改的是“默认启动策略”，新建沙箱会直接继承。对于已经在跑的容器，后台会尽量在线更新；如果你是把限制从有改到无，建议让对应沙箱重建一次。
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="btn-primary px-4 py-2 text-sm"
            >
              {loading ? "保存中…" : "保存默认策略"}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm({ cpus: "", memory: "", memorySwap: "", pidsLimit: "" });
                setMessage("");
                setError("");
              }}
              disabled={loading}
              className="btn-secondary px-4 py-2 text-sm"
            >
              清空限制
            </button>
          </div>

          {message ? <div className="md:col-span-2 notice-success">{message}</div> : null}
          {error ? <div className="md:col-span-2 notice-error">{error}</div> : null}
        </div>

        <div className="space-y-3">
          <div className="surface-soft px-4 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              当前预览
            </div>
            <div className="mt-2 text-sm font-medium leading-6 text-slate-900">
              {preview}
            </div>
          </div>
          <div className="surface-soft px-4 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              推荐起步
            </div>
            <div className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
              <div>轻量 Agent：`1 CPU · 512m · 1g · 256 PIDs`</div>
              <div>常规 Agent：`1.5 CPU · 1g · 2g · 512 PIDs`</div>
              <div>重工具 Agent：`2 CPU · 2g · 3g · 768 PIDs`</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

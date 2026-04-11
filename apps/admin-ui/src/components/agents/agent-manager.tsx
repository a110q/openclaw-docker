"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ManagedAgent, ProviderRecord } from "@/lib/types/admin";
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog";
import { AgentBundleActions } from "@/components/agents/agent-bundle-actions";
import { filterAgents, type AgentFilterState } from "@/lib/ui/agent-filters";

type ModelOption = {
  id: string;
  label: string;
  providerId?: string;
  modelId?: string;
  isDefault?: boolean;
};
type ComposerMode = "catalog" | "provider";

type AgentFormState = {
  id: string;
  name: string;
  primaryModelId: string;
  imageModelId: string;
  notes: string;
  workspacePath: string;
  agentDirPath: string;
  sandboxCpuLimit: string;
  sandboxMemoryLimit: string;
  sandboxMemorySwap: string;
  sandboxPidsLimit: string;
};

type ProviderComposerState = {
  id: string;
  name: string;
  websiteUrl: string;
  notes: string;
  type: "openai-compatible" | "anthropic" | "gemini" | "ollama";
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  isDefault: boolean;
  modelId: string;
  modelName: string;
};

type DeletePlan = {
  agentIds: string[];
  title: string;
  description: string;
  loadingKey: string;
};

const DEFAULT_FILTERS: AgentFilterState = {
  search: "",
  runtimeStatus: "all",
  source: "all",
  selectedOnly: false,
};

function isUnsafeAgentModel(modelId: string) {
  return modelId.trim().toLowerCase().startsWith("default/glm-");
}

function sortModelsForSelection(models: ModelOption[]) {
  return [...models].sort((left, right) => {
    const leftScore =
      left.isDefault && !isUnsafeAgentModel(left.id)
        ? 0
        : isUnsafeAgentModel(left.id)
          ? 2
          : 1;
    const rightScore =
      right.isDefault && !isUnsafeAgentModel(right.id)
        ? 0
        : isUnsafeAgentModel(right.id)
          ? 2
          : 1;
    if (leftScore !== rightScore) {
      return leftScore - rightScore;
    }
    return left.label.localeCompare(right.label, "zh-Hans-CN");
  });
}

function getRecommendedModelId(models: ModelOption[]) {
  return (
    models.find((model) => model.isDefault && !isUnsafeAgentModel(model.id))
      ?.id ||
    models.find((model) => !isUnsafeAgentModel(model.id))?.id ||
    models[0]?.id ||
    ""
  );
}

function createEmptyAgentForm(models: ModelOption[]): AgentFormState {
  return {
    id: "",
    name: "",
    primaryModelId: getRecommendedModelId(models),
    imageModelId: "",
    notes: "",
    workspacePath: "",
    agentDirPath: "",
    sandboxCpuLimit: "",
    sandboxMemoryLimit: "",
    sandboxMemorySwap: "",
    sandboxPidsLimit: "",
  };
}

function createEmptyProviderComposer(): ProviderComposerState {
  return {
    id: "",
    name: "",
    websiteUrl: "",
    notes: "",
    type: "openai-compatible",
    baseUrl: "",
    apiKey: "",
    enabled: true,
    isDefault: false,
    modelId: "",
    modelName: "",
  };
}

function slugifyProviderId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function splitModelRef(modelRef: string) {
  const [providerId = "", modelId = ""] = modelRef.split("/", 2);
  return { providerId, modelId };
}

function formatRuntimeLabel(status: ManagedAgent["runtimeStatus"]) {
  const labels: Record<ManagedAgent["runtimeStatus"], string> = {
    running: "运行中",
    stopped: "已停止",
    starting: "启动中",
    unhealthy: "异常",
    unknown: "未知",
  };
  return labels[status] || status;
}

function getRuntimeBadgeClass(status: ManagedAgent["runtimeStatus"]) {
  if (status === "running") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "starting") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "unhealthy") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "stopped") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatSourceLabel(source: ManagedAgent["source"]) {
  const labels: Record<ManagedAgent["source"], string> = {
    manual: "手动维护",
    discovered: "自动发现",
    "batch-created": "批量创建",
  };
  return labels[source] || source;
}

function formatSandboxMode(mode: string) {
  const value = mode.trim().toLowerCase();
  if (!value) {
    return "默认";
  }
  if (value === "all") {
    return "全开放";
  }
  if (value === "workspace-write") {
    return "工作区可写";
  }
  if (value === "read-only") {
    return "只读";
  }
  if (value === "danger-full-access") {
    return "完全访问";
  }
  return mode;
}

function compactPath(value: string) {
  const segments = value.split("/").filter(Boolean);
  if (segments.length <= 4) {
    return value;
  }
  return `…/${segments.slice(-4).join("/")}`;
}

function summarizeModelRef(modelRef: string, fallback = "继承默认") {
  const { providerId, modelId } = splitModelRef(modelRef || "");
  if (!providerId && !modelId) {
    return fallback;
  }
  if (!modelId) {
    return providerId;
  }
  return `${modelId} · ${providerId}`;
}

function summarizeSandboxResources(input: {
  sandboxCpuLimit?: number;
  sandboxMemoryLimit?: string;
  sandboxMemorySwap?: string;
  sandboxPidsLimit?: number;
}) {
  return [
    input.sandboxCpuLimit != null ? `CPU ${input.sandboxCpuLimit}` : "CPU 未限制",
    input.sandboxMemoryLimit ? `内存 ${input.sandboxMemoryLimit}` : "内存 未限制",
    input.sandboxMemorySwap ? `Swap ${input.sandboxMemorySwap}` : "Swap 未限制",
    input.sandboxPidsLimit != null ? `PIDs ${input.sandboxPidsLimit}` : "PIDs 未限制",
  ].join(" · ");
}

function summarizeSandboxDefault(input: {
  cpus?: number;
  memory?: string;
  memorySwap?: string;
  pidsLimit?: number;
}) {
  return [
    input.cpus != null ? `CPU ${input.cpus}` : "CPU 未限制",
    input.memory ? `内存 ${input.memory}` : "内存 未限制",
    input.memorySwap ? `Swap ${input.memorySwap}` : "Swap 未限制",
    input.pidsLimit != null ? `PIDs ${input.pidsLimit}` : "PIDs 未限制",
  ].join(" · ");
}

function buildProviderComposer(
  agent: ManagedAgent | null,
  provider: ProviderRecord | undefined,
): ProviderComposerState {
  const currentModel = splitModelRef(agent?.primaryModelId || "");
  return {
    id: provider?.id || currentModel.providerId,
    name: provider?.name || currentModel.providerId,
    websiteUrl: provider?.websiteUrl || "",
    notes: provider?.notes || "",
    type: provider?.type || "openai-compatible",
    baseUrl: provider?.baseUrl || "",
    apiKey: "",
    enabled: provider?.enabled ?? true,
    isDefault: provider?.isDefault ?? false,
    modelId: currentModel.modelId || provider?.modelId || "",
    modelName: provider?.modelName || currentModel.modelId || "",
  };
}

export function AgentManager({
  agents,
  models,
  providers,
  sandboxDefaults = {},
}: {
  agents: ManagedAgent[];
  models: ModelOption[];
  providers: ProviderRecord[];
  sandboxDefaults?: {
    cpus?: number;
    memory?: string;
    memorySwap?: string;
    pidsLimit?: number;
  };
}) {
  const router = useRouter();
  const sortedModels = useMemo(() => sortModelsForSelection(models), [models]);
  const recommendedModelId = useMemo(
    () => getRecommendedModelId(sortedModels),
    [sortedModels],
  );
  const emptyForm = useMemo(
    () => createEmptyAgentForm(sortedModels),
    [sortedModels],
  );
  const emptyProviderComposer = useMemo(
    () => createEmptyProviderComposer(),
    [],
  );
  const [form, setForm] = useState<AgentFormState>(emptyForm);
  const [providerForm, setProviderForm] = useState<ProviderComposerState>(
    emptyProviderComposer,
  );
  const [composerMode, setComposerMode] = useState<ComposerMode>("catalog");
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchModelId, setBatchModelId] = useState(recommendedModelId);
  const [filters, setFilters] = useState<AgentFilterState>(DEFAULT_FILTERS);
  const [deletePlan, setDeletePlan] = useState<DeletePlan | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filteredAgents = useMemo(
    () => filterAgents(agents, filters, selectedIds),
    [agents, filters, selectedIds],
  );
  const allFilteredSelected =
    filteredAgents.length > 0 &&
    filteredAgents.every((agent) => selectedIds.includes(agent.id));
  const hasActiveFilters = Boolean(
    filters.search ||
    filters.runtimeStatus !== "all" ||
    filters.source !== "all" ||
    filters.selectedOnly,
  );
  const editingAgent = agents.find((agent) => agent.id === editingId) || null;
  const selectedPrimaryModel = useMemo(
    () =>
      sortedModels.find((model) => model.id === form.primaryModelId) || null,
    [form.primaryModelId, sortedModels],
  );
  const recommendedModel = useMemo(
    () => sortedModels.find((model) => model.id === recommendedModelId) || null,
    [recommendedModelId, sortedModels],
  );
  const primaryModelIsUnsafe = isUnsafeAgentModel(form.primaryModelId);
  const batchModelIsUnsafe = isUnsafeAgentModel(batchModelId);
  const catalogBasicsReady = Boolean(form.id.trim() && form.name.trim());
  const currentBoundProvider = useMemo(() => {
    const providerId =
      splitModelRef(form.primaryModelId).providerId ||
      splitModelRef(editingAgent?.primaryModelId || "").providerId;
    return providers.find((provider) => provider.id === providerId);
  }, [editingAgent?.primaryModelId, form.primaryModelId, providers]);
  const draftAgentLabel = form.name.trim() || form.id.trim() || "未命名 Agent";
  const currentProviderLabel =
    currentBoundProvider?.name ||
    splitModelRef(form.primaryModelId).providerId ||
    "未设置";
  const currentModelLabel = summarizeModelRef(form.primaryModelId, "未设置");
  const imageModelLabel = summarizeModelRef(
    form.imageModelId || "",
    "沿用主模型",
  );
  const providerDraftLabel =
    providerForm.name.trim() || providerForm.id.trim() || "未命名供应商";
  const providerDraftId =
    providerForm.id.trim() ||
    slugifyProviderId(providerForm.name) ||
    "自动生成";
  const providerDraftReady =
    catalogBasicsReady &&
    Boolean(
      providerForm.baseUrl.trim() &&
      providerForm.modelId.trim() &&
      (providerForm.name.trim() || providerForm.id.trim()),
    );
  const defaultSandboxSummary = summarizeSandboxDefault(sandboxDefaults);
  const draftSandboxSummary = summarizeSandboxResources({
    sandboxCpuLimit: form.sandboxCpuLimit.trim()
      ? Number(form.sandboxCpuLimit)
      : undefined,
    sandboxMemoryLimit: form.sandboxMemoryLimit.trim() || undefined,
    sandboxMemorySwap: form.sandboxMemorySwap.trim() || undefined,
    sandboxPidsLimit: form.sandboxPidsLimit.trim()
      ? Number(form.sandboxPidsLimit)
      : undefined,
  });

  useEffect(() => {
    setBatchModelId((current) =>
      sortedModels.some((model) => model.id === current)
        ? current
        : recommendedModelId,
    );
  }, [recommendedModelId, sortedModels]);

  function syncProviderForm(
    agent: ManagedAgent | null,
    nextPrimaryModelId?: string,
  ) {
    const providerId = splitModelRef(
      nextPrimaryModelId || agent?.primaryModelId || "",
    ).providerId;
    const provider = providers.find((item) => item.id === providerId);
    setProviderForm(buildProviderComposer(agent, provider));
  }

  function reset() {
    setForm(emptyForm);
    setProviderForm(emptyProviderComposer);
    setComposerMode("catalog");
    setEditingId("");
    setMessage("");
    setError("");
  }

  function edit(agent: ManagedAgent) {
    setEditingId(agent.id);
    setForm({
      id: agent.id,
      name: agent.displayName || agent.name,
      primaryModelId: agent.primaryModelId || recommendedModelId,
      imageModelId: agent.imageModelId || "",
      notes: agent.notes || "",
      workspacePath: agent.workspacePath || "",
      agentDirPath: agent.agentDirPath || "",
      sandboxCpuLimit:
        agent.sandboxResourceSource === "agent" && agent.sandboxCpuLimit != null
          ? String(agent.sandboxCpuLimit)
          : "",
      sandboxMemoryLimit:
        agent.sandboxResourceSource === "agent"
          ? agent.sandboxMemoryLimit || ""
          : "",
      sandboxMemorySwap:
        agent.sandboxResourceSource === "agent"
          ? agent.sandboxMemorySwap || ""
          : "",
      sandboxPidsLimit:
        agent.sandboxResourceSource === "agent" && agent.sandboxPidsLimit != null
          ? String(agent.sandboxPidsLimit)
          : "",
    });
    syncProviderForm(agent, agent.primaryModelId);
    setComposerMode("catalog");
    setMessage("");
    setError("");
  }

  function toggleSelection(agentId: string) {
    setSelectedIds((current) =>
      current.includes(agentId)
        ? current.filter((item) => item !== agentId)
        : [...current, agentId],
    );
  }

  function toggleAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filteredAgents.forEach((agent) => next.delete(agent.id));
      } else {
        filteredAgents.forEach((agent) => next.add(agent.id));
      }
      return Array.from(next);
    });
  }

  async function saveAgentRecord(
    nextForm: AgentFormState,
    successMessage: string,
  ) {
    const isEditing = Boolean(editingId);
    const url = isEditing
      ? `/api/admin/v1/agents/${editingId}`
      : "/api/admin/v1/agents";
    const method = isEditing ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...nextForm,
        imageModelId: nextForm.imageModelId || undefined,
        source: "manual",
        tags: [],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || "保存 Agent 失败");
    }
    setMessage(successMessage);
    router.refresh();
  }

  async function submitCatalogBinding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("submit-catalog");
    setMessage("");
    setError("");

    try {
      await saveAgentRecord(
        form,
        editingId
          ? `已更新 Agent ${form.id} 的模型绑定`
          : `已创建 Agent ${form.id}`,
      );
      if (!editingId) {
        reset();
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "保存 Agent 失败",
      );
    } finally {
      setLoading("");
    }
  }

  async function submitProviderBinding(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setLoading("submit-provider");
    setMessage("");
    setError("");

    try {
      if (!form.id.trim()) {
        throw new Error("请先填写 Agent 标识");
      }
      if (!form.name.trim()) {
        throw new Error("请先填写 Agent 名称");
      }

      const providerId =
        providerForm.id.trim() ||
        slugifyProviderId(providerForm.name) ||
        `${form.id}-provider`;
      const providerName = providerForm.name.trim() || providerId;
      const modelId = providerForm.modelId.trim();
      const modelName = providerForm.modelName.trim() || modelId;

      if (!providerId) {
        throw new Error("请填写供应商标识");
      }
      if (!providerName) {
        throw new Error("请填写供应商名称");
      }
      if (!providerForm.baseUrl.trim()) {
        throw new Error("请填写 API 请求地址");
      }
      if (!modelId) {
        throw new Error("请填写模型 ID");
      }

      const providerExists = providers.some(
        (provider) => provider.id === providerId,
      );
      const providerResponse = await fetch(
        providerExists
          ? `/api/admin/v1/providers/${providerId}`
          : "/api/admin/v1/providers",
        {
          method: providerExists ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...providerForm,
            id: providerId,
            name: providerName,
            modelId,
            modelName,
            enabled: true,
          }),
        },
      );
      const providerPayload = (await providerResponse
        .json()
        .catch(() => ({}))) as { error?: string };
      if (!providerResponse.ok) {
        throw new Error(providerPayload.error || "保存 Provider 失败");
      }

      const nextAgentForm = {
        ...form,
        primaryModelId: `${providerId}/${modelId}`,
      };
      await saveAgentRecord(
        nextAgentForm,
        `已保存供应商并绑定到 Agent ${form.id}`,
      );
      setForm(nextAgentForm);
      setProviderForm((current) => ({
        ...current,
        id: providerId,
        name: providerName,
        modelId,
        modelName,
      }));
      if (!editingId) {
        setEditingId(form.id);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "保存并绑定失败",
      );
    } finally {
      setLoading("");
    }
  }

  function askDelete(agentIds: string[]) {
    if (!agentIds.length) {
      setError("请先选择至少一个 Agent");
      return;
    }

    const loadingKey =
      agentIds.length === 1 ? `delete:${agentIds[0]}` : "batch-delete";
    setDeletePlan({
      agentIds,
      loadingKey,
      title:
        agentIds.length === 1
          ? `删除 Agent · ${agentIds[0]}`
          : `批量删除 ${agentIds.length} 个 Agent`,
      description:
        agentIds.length === 1
          ? `删除后 ${agentIds[0]} 会从当前纳管列表中移除，并同步清理对应的沙箱容器。`
          : `删除后会从纳管列表中移除这 ${agentIds.length} 个 Agent，并同步清理对应的沙箱容器。该操作不会清空宿主机工作区目录。`,
    });
  }

  async function performDelete() {
    if (!deletePlan) {
      return;
    }

    setLoading(deletePlan.loadingKey);
    setMessage("");
    setError("");

    try {
      const deleted = await Promise.all(
        deletePlan.agentIds.map(async (agentId) => {
          const response = await fetch(`/api/admin/v1/agents/${agentId}`, {
            method: "DELETE",
          });
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          if (!response.ok) {
            throw new Error(payload.error || `删除 ${agentId} 失败`);
          }
          return agentId;
        }),
      );
      if (editingId && deleted.includes(editingId)) {
        reset();
      }
      setSelectedIds((current) =>
        current.filter((id) => !deleted.includes(id)),
      );
      setDeletePlan(null);
      setMessage(
        deleted.length === 1
          ? `已删除 Agent ${deleted[0]}`
          : `已删除 ${deleted.length} 个 Agent`,
      );
      router.refresh();
    } catch (deleteError) {
      setDeletePlan(null);
      setError(
        deleteError instanceof Error ? deleteError.message : "删除 Agent 失败",
      );
    } finally {
      setLoading("");
    }
  }

  async function batchUpdateModel() {
    if (!selectedIds.length) {
      setError("请先选择至少一个 Agent");
      return;
    }
    setLoading("batch-model");
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/v1/agents/bindings/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentIds: selectedIds,
          primaryModelId: batchModelId,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "批量改模型失败");
      setMessage(`已为 ${selectedIds.length} 个 Agent 更新模型`);
      router.refresh();
    } catch (batchError) {
      setError(
        batchError instanceof Error ? batchError.message : "批量改模型失败",
      );
    } finally {
      setLoading("");
    }
  }

  return (
    <>
      <div className="grid gap-5 2xl:grid-cols-[372px_minmax(0,1fr)] xl:items-start">
        <section className="surface-panel overflow-hidden p-4 md:p-5 xl:sticky xl:top-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="page-eyebrow">Agent 运维台</div>
              <h2 className="mt-2 text-[1.32rem] font-semibold tracking-tight text-slate-900">
                已纳管 Agent
              </h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-600">
                在左侧完成筛选、选择和批量动作；右侧始终保留当前 Agent 的连续配置流，避免来回切页。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="pill-badge">总数 {agents.length}</span>
              <span className="pill-badge">筛选后 {filteredAgents.length}</span>
              <span className="pill-badge">已选 {selectedIds.length}</span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(150px,0.78fr)_minmax(150px,0.78fr)]">
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                搜索
              </span>
              <input
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                className="field"
                placeholder="搜索 Agent 标识 / 名称 / 模型 / 备注"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                运行状态
              </span>
              <select
                value={filters.runtimeStatus}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    runtimeStatus: event.target
                      .value as AgentFilterState["runtimeStatus"],
                  }))
                }
                className="field"
              >
                <option value="all">全部状态</option>
                <option value="running">运行中</option>
                <option value="stopped">已停止</option>
                <option value="starting">启动中</option>
                <option value="unhealthy">异常</option>
                <option value="unknown">未知</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                纳管来源
              </span>
              <select
                value={filters.source}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    source: event.target.value as AgentFilterState["source"],
                  }))
                }
                className="field"
              >
                <option value="all">全部来源</option>
                <option value="manual">手动维护</option>
                <option value="discovered">自动发现</option>
                <option value="batch-created">批量创建</option>
              </select>
            </label>
          </div>

          <div className="console-toolbar mt-4 justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <span>
                当前结果 {filteredAgents.length} / {agents.length}
              </span>
              <span className="text-slate-400">•</span>
              <span>已选 {selectedIds.length}</span>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  清空筛选
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  setFilters((current) => ({
                    ...current,
                    selectedOnly: !current.selectedOnly,
                  }))
                }
                className={`rounded-full border px-2.5 py-1 text-xs ${filters.selectedOnly ? "border-sky-500/40 bg-sky-500/10 text-sky-700" : "border-slate-200 text-slate-700 hover:bg-slate-100"}`}
              >
                {filters.selectedOnly ? "仅看已选中" : "显示全部"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <button
                type="button"
                onClick={reset}
                className="btn-secondary px-4 py-2 text-xs"
              >
                新建 Agent
              </button>
              <button
                type="button"
                onClick={toggleAllFiltered}
                className="btn-secondary px-4 py-2 text-xs"
              >
                {allFilteredSelected ? "取消全选当前结果" : "全选当前结果"}
              </button>
            </div>
          </div>

          <div className="surface-soft mt-3 flex flex-wrap items-center gap-2 px-3 py-3">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
              <span className="pl-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                批量模型
              </span>
              <select
                aria-label="批量模型"
                value={batchModelId}
                onChange={(event) => setBatchModelId(event.target.value)}
                className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
              >
                {sortedModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={batchUpdateModel}
              disabled={loading === "batch-model" || batchModelIsUnsafe}
              className="btn-primary px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading === "batch-model"
                ? "处理中…"
                : batchModelIsUnsafe
                  ? "模型不可批量下发"
                  : "批量改模型"}
            </button>
            <button
              type="button"
              onClick={() => askDelete(selectedIds)}
              disabled={loading === "batch-delete"}
              className="btn-danger px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading === "batch-delete" ? "处理中…" : "批量删除"}
            </button>
            <AgentBundleActions
              selectedIds={selectedIds}
              onSuccess={(nextMessage) => {
                setMessage(nextMessage);
                setError("");
              }}
              onError={(nextError) => {
                setError(nextError);
                setMessage("");
              }}
            />
          </div>

          <div className="mt-4 space-y-3 xl:max-h-[calc(100vh-18.5rem)] xl:overflow-y-auto xl:pr-1">
            {filteredAgents.length ? (
              filteredAgents.map((agent) => {
                const checked = selectedIds.includes(agent.id);
                const isDeleting = loading === `delete:${agent.id}`;
                const isEditing = editingId === agent.id;
                const boundProvider = providers.find(
                  (provider) =>
                    provider.id ===
                    splitModelRef(agent.primaryModelId || "").providerId,
                );
                return (
                  <div
                    key={agent.id}
                    className={`list-row px-4 py-4 ${
                      isEditing
                        ? "border-sky-300 bg-[linear-gradient(180deg,rgba(247,251,255,0.99),rgba(255,255,255,0.97))] shadow-[0_16px_34px_-28px_rgba(14,116,144,0.22)]"
                        : "border-slate-200/90 bg-white/98 shadow-[0_12px_28px_-26px_rgba(15,23,42,0.18)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelection(agent.id)}
                        className="mt-1.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.96))] text-sm font-semibold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                              {(agent.displayName || agent.id)
                                .slice(0, 1)
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="truncate text-[1rem] font-semibold text-slate-900">
                                  {agent.displayName}
                                </div>
                                <span
                                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getRuntimeBadgeClass(agent.runtimeStatus)}`}
                                >
                                  {formatRuntimeLabel(agent.runtimeStatus)}
                                </span>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                                  {formatSourceLabel(agent.source)}
                                </span>
                                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                                  {agent.inheritsDefaultModel
                                    ? "继承默认"
                                    : "显式绑定"}
                                </span>
                                {isEditing ? (
                                  <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] text-sky-700">
                                    当前编辑
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
                                <span className="font-mono text-slate-600">
                                  {agent.id}
                                </span>
                                <span>
                                  供应商 · {boundProvider?.name || splitModelRef(agent.primaryModelId || "").providerId || "默认"}
                                </span>
                                <span>沙箱 · {formatSandboxMode(agent.sandboxMode)}</span>
                                <span>资源 · {agent.sandboxResourceSource === "agent" ? "单独覆盖" : "继承默认"}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                            <button
                              type="button"
                              onClick={() => edit(agent)}
                              aria-label={`配置 ${agent.displayName}`}
                              className="btn-secondary px-4 py-2 text-xs"
                            >
                              配置
                            </button>
                            <button
                              type="button"
                              onClick={() => askDelete([agent.id])}
                              disabled={Boolean(loading)}
                              className="btn-danger px-4 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isDeleting ? "删除中…" : "删除"}
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
                          <div className="min-w-0 rounded-[18px] border border-slate-200 bg-white/88 px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              主模型
                            </div>
                            <div className="mt-1.5 min-w-0 truncate text-sm font-medium text-slate-900">
                              {summarizeModelRef(agent.primaryModelId)}
                            </div>
                          </div>
                          <div className="min-w-0 rounded-[18px] border border-slate-200 bg-white/88 px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              图片模型
                            </div>
                            <div className="mt-1.5 min-w-0 truncate text-sm font-medium text-slate-900">
                              {summarizeModelRef(
                                agent.imageModelId || "",
                                "沿用主模型",
                              )}
                            </div>
                          </div>
                          <div className="min-w-0 rounded-[18px] border border-slate-200 bg-white/88 px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              供应商
                            </div>
                            <div className="mt-1.5 min-w-0 truncate text-sm font-medium text-slate-900">
                              {boundProvider?.name ||
                                splitModelRef(agent.primaryModelId || "").providerId ||
                                "默认"}
                            </div>
                          </div>
                          <div className="min-w-0 rounded-[18px] border border-slate-200 bg-white/88 px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              沙箱模式
                            </div>
                            <div className="mt-1.5 min-w-0 truncate text-sm font-medium text-slate-900">
                              {formatSandboxMode(agent.sandboxMode)}
                            </div>
                          </div>
                          <div className="min-w-0 rounded-[18px] border border-slate-200 bg-white/88 px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              资源策略
                            </div>
                            <div className="mt-1.5 text-sm font-medium leading-6 text-slate-900">
                              {summarizeSandboxResources(agent)}
                            </div>
                            <div className="mt-1 text-[12px] text-slate-500">
                              {agent.sandboxResourceSource === "agent" ? "Agent 单独覆盖" : "继承系统默认"}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 xl:grid-cols-2">
                          <div className="rounded-[18px] border border-slate-200/90 bg-slate-50/88 px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              工作目录
                            </div>
                            <div
                              className="mt-1.5 truncate font-mono text-[12px] text-slate-600"
                              title={agent.workspacePath}
                            >
                              {compactPath(agent.workspacePath)}
                            </div>
                          </div>
                          <div className="rounded-[18px] border border-slate-200/90 bg-slate-50/88 px-3 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              Agent 数据目录
                            </div>
                            <div
                              className="mt-1.5 truncate font-mono text-[12px] text-slate-600"
                              title={agent.agentDirPath}
                            >
                              {compactPath(agent.agentDirPath)}
                            </div>
                          </div>
                        </div>

                        {agent.notes ? (
                          <div className="mt-3 rounded-[18px] border border-slate-200/90 bg-slate-50/90 px-3 py-3 text-sm leading-6 text-slate-600">
                            <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                              备注
                            </span>
                            {agent.notes}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[20px] border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                当前筛选条件下没有 Agent
              </div>
            )}
          </div>
        </section>

        <section className="surface-panel p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="page-eyebrow">Agent 工作目录</div>
              <h2 className="mt-2 text-[1.32rem] font-semibold tracking-tight text-slate-900">
                {editingId ? `配置 Agent · ${editingId}` : "创建 Agent 并配置模型 / 目录 / 资源"}
              </h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-600">
                先确认基础资料，再选择绑定已有模型，或直接新增 Provider 并绑定到当前 Agent。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill-badge">
                {editingId ? "编辑模式" : "新建模式"}
              </span>
              {editingId ? (
                <button
                  type="button"
                  onClick={reset}
                  className="btn-secondary px-4 py-2 text-xs"
                >
                  切换到新建
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            <div className="surface-soft px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                当前 Agent
              </div>
              <div className="mt-2 break-words text-base font-semibold text-slate-900">
                {draftAgentLabel}
              </div>
              <div className="mt-1 font-mono text-[12px] text-slate-500">
                {form.id.trim() || "等待填写 Agent 标识"}
              </div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                接入方式
              </div>
              <div className="mt-2 text-base font-semibold text-slate-900">
                {composerMode === "catalog"
                  ? "绑定现有模型"
                  : "新增供应商并绑定"}
              </div>
              <div className="mt-1 text-[12px] text-slate-500">
                {composerMode === "catalog"
                  ? "直接从现有模型目录中绑定"
                  : "现场接入新 API 并保存"}
              </div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                主模型
              </div>
              <div className="mt-2 break-words text-base font-semibold text-slate-900">
                {currentModelLabel}
              </div>
              <div className="mt-1 text-[12px] text-slate-500">
                {selectedPrimaryModel?.isDefault && !primaryModelIsUnsafe
                  ? "当前默认模型"
                  : primaryModelIsUnsafe
                    ? "当前模型存在风险"
                    : "已显式指定"}
              </div>
            </div>
            <div className="surface-soft px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                当前供应商
              </div>
              <div className="mt-2 break-words text-base font-semibold text-slate-900">
                {currentProviderLabel}
              </div>
              <div className="mt-1 text-[12px] text-slate-500">
                {currentBoundProvider?.baseUrl
                  ? compactPath(currentBoundProvider.baseUrl)
                  : "等待绑定供应商"}
              </div>
            </div>
          </div>

          <div className="surface-card mt-5 p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  基础档案
                </div>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                  基础信息
                </h3>
              </div>
              {currentBoundProvider ? (
                <span className="pill-badge">
                  当前供应商 · {currentBoundProvider.name}
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-700">
                    Agent 标识
                  </span>
                  <input
                    aria-label="Agent 标识"
                    value={form.id}
                    disabled={Boolean(editingId)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        id: event.target.value,
                      }))
                    }
                    className="field disabled:cursor-not-allowed disabled:opacity-70"
                    placeholder="backend-001"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-700">
                    显示名称
                  </span>
                  <input
                    aria-label="显示名称"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="field"
                    placeholder="Backend Agent"
                  />
                </label>
              </div>

              <div className="surface-soft px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  草稿概览
                </div>
                <div className="mt-3 text-base font-semibold text-slate-900">
                  {draftAgentLabel}
                </div>
                <div className="mt-1 font-mono text-[12px] text-slate-500">
                  {form.id.trim() || "等待填写 Agent 标识"}
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-[18px] border border-slate-200 bg-white/86 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      当前模式
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {composerMode === "catalog"
                        ? "绑定现有模型"
                        : "新增供应商并绑定"}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white/86 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      推荐主模型
                    </div>
                    <div className="mt-1 break-words text-sm font-medium text-slate-900">
                      {recommendedModel?.label || "暂无推荐模型"}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white/86 px-3 py-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span>基础信息</span>
                      <span
                        className={
                          catalogBasicsReady
                            ? "text-emerald-600"
                            : "text-slate-400"
                        }
                      >
                        {catalogBasicsReady ? "已完成" : "待填写"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span>模型绑定</span>
                      <span
                        className={
                          !primaryModelIsUnsafe && form.primaryModelId
                            ? "text-emerald-600"
                            : "text-slate-400"
                        }
                      >
                        {!primaryModelIsUnsafe && form.primaryModelId
                          ? "可保存"
                          : "待确认"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="console-note mt-4">
              先填基础信息，再在下方绑定主模型即可创建。目录、资源、图片模型和备注都收进高级选项，避免新建流程过长。
            </div>
          </div>

          <div className="surface-card mt-5 p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  模型接入
                </div>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                  模型接入方式
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  把“绑定已有模型”和“新增 Provider 再绑定”统一到同一块工作区里，减少跳转和滚动。
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setComposerMode("catalog")}
                className={`rounded-[24px] border px-4 py-4 text-left transition ${
                  composerMode === "catalog"
                    ? "border-sky-300 bg-sky-50/92 shadow-[0_12px_28px_-24px_rgba(14,116,144,0.18)]"
                    : "border-slate-200 bg-white/96 hover:border-slate-300"
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">
                  绑定现有模型
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-600">
                  适合已经存在 Provider 和模型目录时，直接选定主模型并保存到 Agent。
                </div>
              </button>
              <button
                type="button"
                onClick={() => setComposerMode("provider")}
                className={`rounded-[24px] border px-4 py-4 text-left transition ${
                  composerMode === "provider"
                    ? "border-sky-300 bg-sky-50/92 shadow-[0_12px_28px_-24px_rgba(14,116,144,0.18)]"
                    : "border-slate-200 bg-white/96 hover:border-slate-300"
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">
                  新增供应商并绑定
                </div>
                <div className="mt-1 text-sm leading-6 text-slate-600">
                  适合手里有新的 API 地址和 Key，现场接入后直接绑定到当前 Agent。
                </div>
              </button>
            </div>

            {composerMode === "catalog" ? (
              <form className="mt-5" onSubmit={submitCatalogBinding}>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-slate-200 bg-white/90 px-4 py-4">
                      <label className="block">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                          <span>主模型</span>
                          {selectedPrimaryModel?.isDefault && !primaryModelIsUnsafe ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700">
                              当前默认
                            </span>
                          ) : null}
                          {form.primaryModelId === recommendedModelId &&
                          !primaryModelIsUnsafe ? (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] text-sky-700">
                              推荐
                            </span>
                          ) : null}
                        </div>
                        <select
                          aria-label="主模型"
                          value={form.primaryModelId}
                          onChange={(event) => {
                            const nextModelId = event.target.value;
                            setForm((current) => ({
                              ...current,
                              primaryModelId: nextModelId,
                            }));
                            syncProviderForm(editingAgent, nextModelId);
                          }}
                          className="field"
                        >
                          {sortedModels.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.label}
                            </option>
                          ))}
                        </select>
                        <div className="mt-2 text-xs leading-5 text-slate-500">
                          新建 Agent 会优先预选已验证模型；`default/glm-*` 不再自动带入。
                        </div>
                      </label>
                    </div>

                    {primaryModelIsUnsafe ? (
                      <div className="rounded-[22px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-6 text-amber-900">
                        当前选中的是 `default/glm-*` 兼容模型，已知容易导致 Agent 工具调用异常。请先切换到 Claude、Gemini 或已验证模型后再保存。
                      </div>
                    ) : (
                      <div className="rounded-[22px] border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm leading-6 text-sky-900">
                        当前模式适合直接从现有模型目录里选一个绑定到 Agent。如果你想像 cc switch 一样现场接入新的 API / Provider，请切到“新增供应商并绑定”。
                      </div>
                    )}

                    <details className="rounded-[22px] border border-slate-200 bg-white/80 px-4 py-4">
                      <summary className="cursor-pointer list-none text-sm font-medium text-slate-900">
                        高级选项：目录 / 资源 / 图片模型 / 备注
                      </summary>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-sm text-slate-700">
                            工作目录（可选）
                          </span>
                          <input
                            value={form.workspacePath}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                workspacePath: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder={editingAgent?.workspacePath || "留空则按默认目录生成"}
                          />
                          <div className="mt-2 text-xs leading-5 text-slate-500">
                            支持宿主机数据根目录下的相对路径，或该根目录内的绝对路径。
                          </div>
                        </label>
                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-sm text-slate-700">
                            Agent 数据目录（可选）
                          </span>
                          <input
                            value={form.agentDirPath}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                agentDirPath: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder={editingAgent?.agentDirPath || "留空则按默认目录生成"}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm text-slate-700">
                            CPU 上限（可选）
                          </span>
                          <input
                            value={form.sandboxCpuLimit}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                sandboxCpuLimit: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder={sandboxDefaults.cpus != null ? String(sandboxDefaults.cpus) : "继承默认（当前未限制）"}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm text-slate-700">
                            内存上限（可选）
                          </span>
                          <input
                            value={form.sandboxMemoryLimit}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                sandboxMemoryLimit: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder={sandboxDefaults.memory || "继承默认（当前未限制）"}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm text-slate-700">
                            交换内存（可选）
                          </span>
                          <input
                            value={form.sandboxMemorySwap}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                sandboxMemorySwap: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder={sandboxDefaults.memorySwap || "继承默认（当前未限制）"}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm text-slate-700">
                            PIDs 上限（可选）
                          </span>
                          <input
                            value={form.sandboxPidsLimit}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                sandboxPidsLimit: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder={sandboxDefaults.pidsLimit != null ? String(sandboxDefaults.pidsLimit) : "继承默认（当前未限制）"}
                          />
                        </label>
                        <div className="md:col-span-2 rounded-[18px] border border-slate-200 bg-slate-50/80 px-3 py-3 text-xs leading-6 text-slate-600">
                          当前系统默认资源：{defaultSandboxSummary}。这里留空表示继续继承系统默认；只在你填写时才会把它固化成该 Agent 的单独覆盖。
                        </div>
                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-sm text-slate-700">
                            图片模型（可选）
                          </span>
                          <select
                            aria-label="图片模型（可选）"
                            value={form.imageModelId}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                imageModelId: event.target.value,
                              }))
                            }
                            className="field"
                          >
                            <option value="">不单独指定，沿用主模型</option>
                            {sortedModels.map((model) => (
                              <option key={model.id} value={model.id}>
                                {model.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-sm text-slate-700">
                            备注
                          </span>
                          <textarea
                            value={form.notes}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            className="field min-h-24"
                            placeholder="例如：用于值班、灰度实验或特定技术栈任务"
                          />
                        </label>
                      </div>
                    </details>
                  </div>

                  <div className="surface-soft px-4 py-4 xl:sticky xl:top-6 xl:self-start">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      当前草稿
                    </div>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="text-[13px] text-slate-500">Agent</div>
                        <div className="mt-1 break-words text-base font-semibold text-slate-900">
                          {draftAgentLabel}
                        </div>
                        <div className="mt-1 font-mono text-[12px] text-slate-500">
                          {form.id.trim() || "等待填写 Agent 标识"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[13px] text-slate-500">
                          当前供应商
                        </div>
                        <div className="mt-1 break-words text-sm font-medium text-slate-900">
                          {currentProviderLabel}
                        </div>
                      </div>
                      <div>
                        <div className="text-[13px] text-slate-500">
                          绑定主模型
                        </div>
                        <div className="mt-1 break-words text-sm font-medium text-slate-900">
                          {currentModelLabel}
                        </div>
                      </div>
                      <div>
                        <div className="text-[13px] text-slate-500">
                          图片模型
                        </div>
                        <div className="mt-1 break-words text-sm font-medium text-slate-900">
                          {imageModelLabel}
                        </div>
                      </div>
                      <div>
                        <div className="text-[13px] text-slate-500">
                          工作目录
                        </div>
                        <div className="mt-1 break-all text-[12px] font-medium text-slate-900">
                          {form.workspacePath.trim() || "留空则按默认目录生成"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[13px] text-slate-500">
                          Agent 数据目录
                        </div>
                        <div className="mt-1 break-all text-[12px] font-medium text-slate-900">
                          {form.agentDirPath.trim() || "留空则按默认目录生成"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[13px] text-slate-500">
                          沙箱资源
                        </div>
                        <div className="mt-1 break-words text-sm font-medium leading-6 text-slate-900">
                          {draftSandboxSummary}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <span>基础信息</span>
                        <span
                          className={
                            catalogBasicsReady
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }
                        >
                          {catalogBasicsReady ? "已完成" : "待填写"}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span>模型选择</span>
                        <span
                          className={
                            !primaryModelIsUnsafe && form.primaryModelId
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }
                        >
                          {!primaryModelIsUnsafe && form.primaryModelId
                            ? "可保存"
                            : "需调整"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        type="submit"
                        disabled={
                          loading === "submit-catalog" ||
                          primaryModelIsUnsafe ||
                          !catalogBasicsReady
                        }
                        className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading === "submit-catalog"
                          ? "保存中…"
                          : primaryModelIsUnsafe
                            ? "请先更换主模型"
                            : editingId
                              ? "保存 Agent 配置"
                              : "创建 Agent"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposerMode("provider")}
                        className="btn-secondary w-full justify-center"
                      >
                        切到供应商接入
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              <form className="mt-5" onSubmit={submitProviderBinding}>
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-slate-200 bg-white/90 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Provider Access
                          </div>
                          <div className="mt-1 text-sm font-medium text-slate-900">
                            供应商接入信息
                          </div>
                        </div>
                        <span className="pill-badge">接入后自动绑定到当前 Agent</span>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            供应商名称
                          </span>
                          <input
                            value={providerForm.name}
                            onChange={(event) =>
                              setProviderForm((current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            onBlur={() => {
                              if (
                                !providerForm.id.trim() &&
                                providerForm.name.trim()
                              ) {
                                setProviderForm((current) => ({
                                  ...current,
                                  id: slugifyProviderId(current.name),
                                }));
                              }
                            }}
                            className="field"
                            placeholder="例如：Claude 官方 / 公司专用网关"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            备注
                          </span>
                          <input
                            value={providerForm.notes}
                            onChange={(event) =>
                              setProviderForm((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder="例如：公司专用账号"
                          />
                        </label>
                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            官网链接
                          </span>
                          <input
                            value={providerForm.websiteUrl}
                            onChange={(event) =>
                              setProviderForm((current) => ({
                                ...current,
                                websiteUrl: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder="https://example.com（可选）"
                          />
                        </label>
                        <label className="block md:col-span-2">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            API Key
                          </span>
                          <input
                            value={providerForm.apiKey}
                            onChange={(event) =>
                              setProviderForm((current) => ({
                                ...current,
                                apiKey: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder="只需要填这里，下方配置会自动一起保存"
                          />
                        </label>
                        <label className="block md:col-span-2">
                          <div className="mb-2 flex items-center justify-between gap-3 text-sm font-medium text-slate-700">
                            <span>API 请求地址</span>
                            <span className="text-xs font-normal text-slate-400">
                              兼容 OpenAI Responses / Chat Completions 的网关更适合
                            </span>
                          </div>
                          <input
                            value={providerForm.baseUrl}
                            onChange={(event) =>
                              setProviderForm((current) => ({
                                ...current,
                                baseUrl: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder="https://your-api-endpoint.com/v1"
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900">
                      填写兼容 OpenAI Response 格式的服务端点地址。保存后会先创建 / 更新全局供应商，再自动绑定到当前 Agent。
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white/90 px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Model Identity
                          </div>
                          <div className="mt-1 text-sm font-medium text-slate-900">
                            模型与默认策略
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            模型名称
                          </span>
                          <input
                            value={providerForm.modelName}
                            onChange={(event) =>
                              setProviderForm((current) => ({
                                ...current,
                                modelName: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder="例如：GPT 5.4 / Claude Sonnet 4.5"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            模型 ID
                          </span>
                          <input
                            value={providerForm.modelId}
                            onChange={(event) =>
                              setProviderForm((current) => ({
                                ...current,
                                modelId: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder="gpt-5.4"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            供应商标识
                          </span>
                          <input
                            value={providerForm.id}
                            onChange={(event) =>
                              setProviderForm((current) => ({
                                ...current,
                                id: event.target.value,
                              }))
                            }
                            className="field"
                            placeholder="留空则按供应商名称自动生成"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            类型
                          </span>
                          <select
                            value={providerForm.type}
                            onChange={(event) =>
                              setProviderForm((current) => ({
                                ...current,
                                type: event.target
                                  .value as ProviderComposerState["type"],
                              }))
                            }
                            className="field"
                          >
                            <option value="openai-compatible">
                              OpenAI Compatible
                            </option>
                            <option value="anthropic">Anthropic</option>
                            <option value="gemini">Gemini</option>
                            <option value="ollama">Ollama</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 md:col-span-2">
                          <input
                            type="checkbox"
                            checked={providerForm.isDefault}
                            onChange={(event) =>
                              setProviderForm((current) => ({
                                ...current,
                                isDefault: event.target.checked,
                              }))
                            }
                          />
                          同时把这个新模型设为系统默认模型
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="surface-soft px-4 py-4 xl:sticky xl:top-6 xl:self-start">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      供应商草稿
                    </div>
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="text-[13px] text-slate-500">
                          目标 Agent
                        </div>
                        <div className="mt-1 break-words text-base font-semibold text-slate-900">
                          {draftAgentLabel}
                        </div>
                        <div className="mt-1 font-mono text-[12px] text-slate-500">
                          {form.id.trim() || "等待填写 Agent 标识"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[13px] text-slate-500">供应商</div>
                        <div className="mt-1 break-words text-sm font-medium text-slate-900">
                          {providerDraftLabel}
                        </div>
                        <div className="mt-1 font-mono text-[12px] text-slate-500">
                          {providerDraftId}
                        </div>
                      </div>
                      <div>
                        <div className="text-[13px] text-slate-500">
                          绑定模型
                        </div>
                        <div className="mt-1 break-words text-sm font-medium text-slate-900">
                          {providerForm.modelId.trim() || "等待填写模型 ID"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[13px] text-slate-500">
                          接口地址
                        </div>
                        <div className="mt-1 break-all text-sm font-medium text-slate-900">
                          {providerForm.baseUrl.trim() || "等待填写 API 地址"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/80 px-3 py-3 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <span>基础信息</span>
                        <span
                          className={
                            catalogBasicsReady
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }
                        >
                          {catalogBasicsReady ? "已完成" : "待填写"}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span>供应商配置</span>
                        <span
                          className={
                            providerDraftReady
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }
                        >
                          {providerDraftReady ? "可保存" : "待补充"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        type="submit"
                        disabled={
                          loading === "submit-provider" || !providerDraftReady
                        }
                        className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loading === "submit-provider"
                          ? "保存中…"
                          : !providerDraftReady
                            ? "请先补全配置"
                            : "保存并绑定到当前 Agent"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposerMode("catalog")}
                        className="btn-secondary w-full justify-center"
                      >
                        返回绑定现有模型
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>

          {message ? <div className="mt-4 notice-success">{message}</div> : null}
          {error ? <div className="mt-4 notice-error">{error}</div> : null}
        </section>
      </div>
      <ConfirmActionDialog
        open={Boolean(deletePlan)}
        title={deletePlan?.title || "删除 Agent"}
        description={deletePlan?.description || ""}
        confirmLabel="确认删除"
        pending={deletePlan ? loading === deletePlan.loadingKey : false}
        onClose={() => setDeletePlan(null)}
        onConfirm={performDelete}
      />
    </>
  );
}

import { z } from "zod";
import { providerInputSchema } from "@/lib/schemas/admin";
import type {
  ModelCatalogItem,
  ProviderModelRecord,
  ProviderRecord,
  ProviderType,
} from "@/lib/types/admin";
import {
  readOpenClawConfig,
  resolveEnvTemplate,
  writeEnvValues,
  writeOpenClawConfig,
  readEnvFile,
} from "./config-files";
import { createTask, updateTask } from "./tasks";
import { logActivity } from "./activity";
import {
  deleteProviderMetadata,
  readProviderMetadataMap,
  readProviderTestSnapshots,
  writeProviderMetadata,
  writeProviderTestSnapshot,
  type ProviderTestSnapshot,
} from "./settings";
import { assertSafeDefaultModel } from "./model-policy";

const BUILTIN_ENV_KEYS: Record<string, { baseUrl?: string; apiKey?: string }> =
  {
    default: {
      baseUrl: "OPENAI_COMPATIBLE_BASE_URL",
      apiKey: "OPENAI_COMPATIBLE_API_KEY",
    },
    claude: {
      apiKey: "ANTHROPIC_API_KEY",
    },
    gemini: {
      apiKey: "GEMINI_API_KEY",
    },
  };

interface OpenClawProviderModel {
  id: string;
  name?: string;
  contextWindow?: number;
  maxTokens?: number;
  input?: string[];
}

interface OpenClawProvider {
  baseUrl: string;
  apiKey?: string;
  api?: string;
  models?: OpenClawProviderModel[];
}

interface OpenClawConfig {
  models?: {
    providers?: Record<string, OpenClawProvider>;
  };
  agents?: {
    defaults?: {
      model?: { primary?: string };
      imageModel?: { primary?: string };
    };
  };
}

export { assertSafeDefaultModel };

export interface ProviderConnectivityResult {
  ok: boolean;
  status: number;
  endpoint: string;
  modelId?: string;
  stages: string[];
  modelValidated: boolean;
  error?: string;
}

function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "*".repeat(value.length);
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function mapProviderType(providerId: string, api?: string): ProviderType {
  if (providerId === "ollama") return "ollama";
  if (api === "anthropic-messages") return "anthropic";
  if (api === "google-generative-ai") return "gemini";
  return "openai-compatible";
}

function mapProviderApi(type: ProviderType) {
  if (type === "anthropic") return "anthropic-messages";
  if (type === "gemini") return "google-generative-ai";
  return "openai-completions";
}

type ProviderInput = z.infer<typeof providerInputSchema>;
type ProviderModelDraft = { id: string; name: string };

function sanitizeProviderModelDrafts(models: ProviderModelDraft[]) {
  const seen = new Set<string>();
  const next: ProviderModelDraft[] = [];

  for (const item of models) {
    const id = String(item.id || "").trim();
    const name = String(item.name || "").trim() || id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    next.push({ id, name });
  }

  return next;
}

export function normalizeProviderDraftModels(
  input: ProviderInput,
  existingModels: OpenClawProviderModel[] = [],
) {
  const explicitModels = sanitizeProviderModelDrafts(input.models ?? []);
  if (explicitModels.length) {
    return explicitModels;
  }

  const legacyModelId = String(input.modelId || "").trim();
  const legacyModelName = String(input.modelName || "").trim() || legacyModelId;
  const existingDrafts = sanitizeProviderModelDrafts(
    existingModels.map((model) => ({
      id: String(model.id || ""),
      name: String(model.name || model.id || ""),
    })),
  );

  if (!legacyModelId) {
    return existingDrafts;
  }

  if (!existingDrafts.length) {
    return [{ id: legacyModelId, name: legacyModelName }];
  }

  const modelIndex = existingDrafts.findIndex((item) => item.id === legacyModelId);
  if (modelIndex >= 0) {
    existingDrafts[modelIndex] = { id: legacyModelId, name: legacyModelName };
    return existingDrafts;
  }

  return [...existingDrafts, { id: legacyModelId, name: legacyModelName }];
}

function buildProviderModels(
  drafts: ProviderModelDraft[],
  existingModels: OpenClawProviderModel[] = [],
  type: ProviderType,
) {
  const existingModelMap = new Map(existingModels.map((model) => [model.id, model]));

  return drafts.map((draft) => {
    const existing = existingModelMap.get(draft.id);
    return {
      ...(existing ?? {}),
      id: draft.id,
      name: draft.name,
      input: existing?.input ?? (type === "ollama" ? ["text"] : ["text", "image"]),
    };
  });
}

function resolveProviderDefaultModelId(
  config: OpenClawConfig,
  providerId: string,
) {
  const defaultRef = config.agents?.defaults?.model?.primary || "";
  const [defaultProviderId, defaultModelId] = defaultRef.split("/", 2);
  return defaultProviderId === providerId ? defaultModelId : "";
}

function resolveSubmittedDefaultModelId(
  input: ProviderInput,
  providerId: string,
  config: OpenClawConfig,
  drafts: ProviderModelDraft[],
) {
  const explicitDefaultModelId = String(input.defaultModelId || "").trim();
  if (explicitDefaultModelId && drafts.some((item) => item.id === explicitDefaultModelId)) {
    return explicitDefaultModelId;
  }

  const currentDefaultModelId = resolveProviderDefaultModelId(config, providerId);
  if (currentDefaultModelId && drafts.some((item) => item.id === currentDefaultModelId)) {
    return currentDefaultModelId;
  }

  return drafts[0]?.id || "";
}

export function applyProviderTestSnapshot(
  record: ProviderRecord,
  snapshot?: ProviderTestSnapshot,
): ProviderRecord {
  if (!snapshot) {
    return record;
  }

  return {
    ...record,
    lastTestStatus: snapshot.lastTestStatus,
    lastTestAt: snapshot.lastTestAt,
    lastError: snapshot.lastError,
  };
}

async function readProviderState() {
  const [config, envState] = await Promise.all([
    readOpenClawConfig<OpenClawConfig>(),
    readEnvFile(),
  ]);
  return { config, env: envState.values };
}

type ProviderEnvDraft = {
  baseUrl: string;
  apiKey: string;
};

type ResolvedProviderRuntime = {
  id: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  modelId?: string;
};

export function buildProviderEnvPatch(
  providerId: string,
  draft: ProviderEnvDraft,
  currentEnv: Record<string, string>,
) {
  const envKeys = BUILTIN_ENV_KEYS[providerId];
  const nextPatch: Record<string, string> = {};

  if (envKeys?.baseUrl) {
    nextPatch[envKeys.baseUrl] =
      draft.baseUrl || currentEnv[envKeys.baseUrl] || "";
  }

  if (envKeys?.apiKey) {
    nextPatch[envKeys.apiKey] =
      draft.apiKey || currentEnv[envKeys.apiKey] || "";
  }

  return nextPatch;
}

function resolveProviderValue(
  providerId: string,
  key: "baseUrl" | "apiKey",
  value: string | undefined,
  env: Record<string, string>,
) {
  if (!value) return "";
  const builtInEnvKey = BUILTIN_ENV_KEYS[providerId]?.[key];
  if (builtInEnvKey && value === `\${${builtInEnvKey}}`) {
    return env[builtInEnvKey] ?? "";
  }
  return resolveEnvTemplate(value, env);
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function appendPath(baseUrl: string, path: string) {
  const normalizedBase = trimTrailingSlash(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function normalizeRemoteModelId(value: string) {
  return value.replace(/^models\//, "").trim();
}

async function readProviderRuntime(
  providerId: string,
): Promise<ResolvedProviderRuntime> {
  const { config, env } = await readProviderState();
  const provider = config.models?.providers?.[providerId];
  if (!provider) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  const preferredModelId =
    resolveProviderDefaultModelId(config, providerId) || provider.models?.[0]?.id;

  return {
    id: providerId,
    type: mapProviderType(providerId, provider.api),
    baseUrl: resolveProviderValue(providerId, "baseUrl", provider.baseUrl, env),
    apiKey: resolveProviderValue(providerId, "apiKey", provider.apiKey, env),
    modelId: preferredModelId,
  };
}

async function parseJson(response: Response) {
  return response.json().catch(() => ({}));
}

async function runOpenAiCompatibleValidation(
  runtime: ResolvedProviderRuntime,
): Promise<ProviderConnectivityResult> {
  const stages: string[] = [];
  const modelsEndpoint = appendPath(runtime.baseUrl, "/models");
  const modelsResponse = await fetch(modelsEndpoint, {
    method: "GET",
    headers: runtime.apiKey
      ? { Authorization: `Bearer ${runtime.apiKey}` }
      : undefined,
    signal: AbortSignal.timeout(8000),
  });
  stages.push(`models:${modelsResponse.status}`);

  const modelsPayload = (await parseJson(modelsResponse)) as {
    data?: Array<{ id?: string }>;
  };
  if (!modelsResponse.ok) {
    return {
      ok: false,
      status: modelsResponse.status,
      endpoint: modelsEndpoint,
      modelId: runtime.modelId,
      stages,
      modelValidated: false,
      error: `模型目录校验失败，HTTP ${modelsResponse.status}`,
    };
  }

  const remoteModelIds = new Set(
    (modelsPayload.data ?? []).map((item) =>
      normalizeRemoteModelId(item.id || ""),
    ),
  );
  if (
    runtime.modelId &&
    remoteModelIds.size > 0 &&
    !remoteModelIds.has(runtime.modelId)
  ) {
    return {
      ok: false,
      status: modelsResponse.status,
      endpoint: modelsEndpoint,
      modelId: runtime.modelId,
      stages,
      modelValidated: false,
      error: `远端模型列表中未找到 ${runtime.modelId}`,
    };
  }

  const chatEndpoint = appendPath(runtime.baseUrl, "/chat/completions");
  const chatResponse = await fetch(chatEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(runtime.apiKey ? { Authorization: `Bearer ${runtime.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: runtime.modelId,
      messages: [{ role: "user", content: "Reply with OK only." }],
      max_tokens: 8,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(12000),
  });
  stages.push(`chat:${chatResponse.status}`);

  const ok = chatResponse.ok;
  return {
    ok,
    status: chatResponse.status,
    endpoint: chatEndpoint,
    modelId: runtime.modelId,
    stages,
    modelValidated: ok,
    error: ok ? undefined : `真实模型请求失败，HTTP ${chatResponse.status}`,
  };
}

async function runAnthropicValidation(
  runtime: ResolvedProviderRuntime,
): Promise<ProviderConnectivityResult> {
  const stages: string[] = [];
  const modelsEndpoint = runtime.baseUrl.includes("/v1")
    ? appendPath(runtime.baseUrl, "/models")
    : appendPath(runtime.baseUrl, "/v1/models");
  const commonHeaders = {
    "x-api-key": runtime.apiKey,
    "anthropic-version": "2023-06-01",
  };
  const modelsResponse = await fetch(modelsEndpoint, {
    method: "GET",
    headers: commonHeaders,
    signal: AbortSignal.timeout(8000),
  });
  stages.push(`models:${modelsResponse.status}`);

  const modelsPayload = (await parseJson(modelsResponse)) as {
    data?: Array<{ id?: string }>;
  };
  if (!modelsResponse.ok) {
    return {
      ok: false,
      status: modelsResponse.status,
      endpoint: modelsEndpoint,
      modelId: runtime.modelId,
      stages,
      modelValidated: false,
      error: `模型目录校验失败，HTTP ${modelsResponse.status}`,
    };
  }

  const remoteModelIds = new Set(
    (modelsPayload.data ?? []).map((item) =>
      normalizeRemoteModelId(item.id || ""),
    ),
  );
  if (
    runtime.modelId &&
    remoteModelIds.size > 0 &&
    !remoteModelIds.has(runtime.modelId)
  ) {
    return {
      ok: false,
      status: modelsResponse.status,
      endpoint: modelsEndpoint,
      modelId: runtime.modelId,
      stages,
      modelValidated: false,
      error: `远端模型列表中未找到 ${runtime.modelId}`,
    };
  }

  const messagesEndpoint = runtime.baseUrl.includes("/v1")
    ? appendPath(runtime.baseUrl, "/messages")
    : appendPath(runtime.baseUrl, "/v1/messages");
  const messagesResponse = await fetch(messagesEndpoint, {
    method: "POST",
    headers: {
      ...commonHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: runtime.modelId,
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply with OK only." }],
    }),
    signal: AbortSignal.timeout(12000),
  });
  stages.push(`messages:${messagesResponse.status}`);

  const ok = messagesResponse.ok;
  return {
    ok,
    status: messagesResponse.status,
    endpoint: messagesEndpoint,
    modelId: runtime.modelId,
    stages,
    modelValidated: ok,
    error: ok ? undefined : `真实模型请求失败，HTTP ${messagesResponse.status}`,
  };
}

async function runGeminiValidation(
  runtime: ResolvedProviderRuntime,
): Promise<ProviderConnectivityResult> {
  const stages: string[] = [];
  const base = trimTrailingSlash(runtime.baseUrl);
  const versionedBase = /\/v\d/i.test(base) ? base : `${base}/v1beta`;
  const modelsEndpoint = `${appendPath(versionedBase, "/models")}?key=${encodeURIComponent(runtime.apiKey)}`;
  const modelsResponse = await fetch(modelsEndpoint, {
    method: "GET",
    signal: AbortSignal.timeout(8000),
  });
  stages.push(`models:${modelsResponse.status}`);

  const modelsPayload = (await parseJson(modelsResponse)) as {
    models?: Array<{ name?: string }>;
  };
  if (!modelsResponse.ok) {
    return {
      ok: false,
      status: modelsResponse.status,
      endpoint: modelsEndpoint,
      modelId: runtime.modelId,
      stages,
      modelValidated: false,
      error: `模型目录校验失败，HTTP ${modelsResponse.status}`,
    };
  }

  const remoteModelIds = new Set(
    (modelsPayload.models ?? []).map((item) =>
      normalizeRemoteModelId(item.name || ""),
    ),
  );
  if (
    runtime.modelId &&
    remoteModelIds.size > 0 &&
    !remoteModelIds.has(runtime.modelId)
  ) {
    return {
      ok: false,
      status: modelsResponse.status,
      endpoint: modelsEndpoint,
      modelId: runtime.modelId,
      stages,
      modelValidated: false,
      error: `远端模型列表中未找到 ${runtime.modelId}`,
    };
  }

  const generateEndpoint = `${appendPath(versionedBase, `/models/${runtime.modelId}:generateContent`)}?key=${encodeURIComponent(runtime.apiKey)}`;
  const generateResponse = await fetch(generateEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Reply with OK only." }] }],
      generationConfig: { maxOutputTokens: 8, temperature: 0 },
    }),
    signal: AbortSignal.timeout(12000),
  });
  stages.push(`generate:${generateResponse.status}`);

  const ok = generateResponse.ok;
  return {
    ok,
    status: generateResponse.status,
    endpoint: generateEndpoint,
    modelId: runtime.modelId,
    stages,
    modelValidated: ok,
    error: ok ? undefined : `真实模型请求失败，HTTP ${generateResponse.status}`,
  };
}

async function validateProviderRuntime(
  runtime: ResolvedProviderRuntime,
): Promise<ProviderConnectivityResult> {
  if (!runtime.baseUrl) {
    return {
      ok: false,
      status: 0,
      endpoint: "",
      modelId: runtime.modelId,
      stages: [],
      modelValidated: false,
      error: "Provider Base URL 未配置",
    };
  }
  if (!runtime.modelId) {
    return {
      ok: false,
      status: 0,
      endpoint: runtime.baseUrl,
      modelId: "",
      stages: [],
      modelValidated: false,
      error: "Provider 模型 ID 未配置",
    };
  }
  if (!runtime.apiKey && runtime.type !== "ollama") {
    return {
      ok: false,
      status: 0,
      endpoint: runtime.baseUrl,
      modelId: runtime.modelId,
      stages: [],
      modelValidated: false,
      error: "Provider API Key 未配置",
    };
  }

  if (runtime.type === "anthropic") return runAnthropicValidation(runtime);
  if (runtime.type === "gemini") return runGeminiValidation(runtime);
  return runOpenAiCompatibleValidation(runtime);
}

export async function listProviders(): Promise<ProviderRecord[]> {
  const [{ config, env }, snapshots, metadataMap] = await Promise.all([
    readProviderState(),
    readProviderTestSnapshots(),
    readProviderMetadataMap(),
  ]);
  const providers = config.models?.providers ?? {};
  const defaultModel = config.agents?.defaults?.model?.primary;
  const defaultProvider = defaultModel?.split("/")[0];

  return Object.entries(providers).map(([providerId, provider]) => {
    const apiKey = resolveProviderValue(
      providerId,
      "apiKey",
      provider.apiKey,
      env,
    );
    const metadata = metadataMap[providerId];
    const providerModels: ProviderModelRecord[] = (provider.models ?? []).map((model) => ({
      id: model.id,
      name: model.name || model.id,
      capabilities: model.input ?? ["text"],
    }));
    const currentDefaultModelId =
      defaultProvider === providerId
        ? resolveProviderDefaultModelId(config, providerId)
        : "";
    const summaryModel =
      providerModels.find((model) => model.id === currentDefaultModelId) ||
      providerModels[0];
    const baseRecord: ProviderRecord = {
      id: providerId,
      name: metadata?.name || providerId,
      type: mapProviderType(providerId, provider.api),
      baseUrl: resolveProviderValue(
        providerId,
        "baseUrl",
        provider.baseUrl,
        env,
      ),
      apiKeyMasked: maskSecret(apiKey),
      apiKeyConfigured: Boolean(apiKey),
      enabled: metadata?.enabled ?? true,
      isDefault: defaultProvider === providerId,
      modelCount: providerModels.length,
      modelId: summaryModel?.id,
      modelName: summaryModel?.name,
      defaultModelId: currentDefaultModelId || summaryModel?.id,
      models: providerModels,
      websiteUrl: metadata?.websiteUrl,
      notes: metadata?.notes,
      lastTestStatus: "unknown",
    };

    return applyProviderTestSnapshot(baseRecord, snapshots[providerId]);
  });
}

export async function listModels(): Promise<ModelCatalogItem[]> {
  const { config } = await readProviderState();
  const providers = config.models?.providers ?? {};
  const defaultModel = config.agents?.defaults?.model?.primary;

  return Object.entries(providers).flatMap(([providerId, provider]) =>
    (provider.models ?? []).map((model) => ({
      id: `${providerId}/${model.id}`,
      providerId,
      modelId: model.id,
      displayName: model.name || model.id,
      capabilities: model.input ?? ["text"],
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
      enabled: true,
      isDefault: `${providerId}/${model.id}` === defaultModel,
    })),
  );
}

export async function saveProvider(input: z.infer<typeof providerInputSchema>) {
  const { config, env } = await readProviderState();
  config.models ??= {};
  config.models.providers ??= {};
  const providers = config.models.providers;
  const providerId = input.id;
  const type = input.type;
  const existing = providers[providerId];
  const draftModels = normalizeProviderDraftModels(input, existing?.models ?? []);

  if (!draftModels.length) {
    throw new Error("至少配置一个模型");
  }

  const defaultModelId = resolveSubmittedDefaultModelId(
    input,
    providerId,
    config,
    draftModels,
  );
  const envKeys = BUILTIN_ENV_KEYS[providerId];
  const envPatch = buildProviderEnvPatch(
    providerId,
    { baseUrl: input.baseUrl, apiKey: input.apiKey },
    env,
  );

  const nextProvider: OpenClawProvider = {
    ...(existing ?? {}),
    baseUrl: envKeys?.baseUrl ? `\${${envKeys.baseUrl}}` : input.baseUrl,
    apiKey: envKeys?.apiKey
      ? `\${${envKeys.apiKey}}`
      : input.apiKey || existing?.apiKey || "",
    api: mapProviderApi(type),
    models: buildProviderModels(draftModels, existing?.models ?? [], type),
  };

  providers[providerId] = nextProvider;

  await writeOpenClawConfig(config);
  if (Object.keys(envPatch).length) {
    await writeEnvValues(envPatch);
  }

  await writeProviderMetadata(providerId, {
    name: input.name,
    websiteUrl: input.websiteUrl,
    notes: input.notes,
    enabled: input.enabled,
  });

  if (input.isDefault) {
    assertSafeDefaultModel(config, `${providerId}/${defaultModelId}`);
    await saveDefaultModel(`${providerId}/${defaultModelId}`);
  }

  await logActivity({
    action: "provider.save",
    targetType: "provider",
    targetId: providerId,
    status: "succeeded",
    summary: `保存 Provider ${providerId}`,
  });

  return providers[providerId];
}

export async function deleteProvider(providerId: string) {
  if (providerId in BUILTIN_ENV_KEYS || providerId === "ollama") {
    throw new Error("内置 Provider 不支持删除");
  }

  const config = await readOpenClawConfig<OpenClawConfig>();
  if (!config.models?.providers?.[providerId]) {
    throw new Error(`Provider not found: ${providerId}`);
  }

  delete config.models.providers[providerId];
  await writeOpenClawConfig(config);
  await deleteProviderMetadata(providerId);
  await logActivity({
    action: "provider.delete",
    targetType: "provider",
    targetId: providerId,
    status: "succeeded",
    summary: `删除 Provider ${providerId}`,
  });
}

export async function saveDefaultModel(modelId: string) {
  const config = await readOpenClawConfig<OpenClawConfig>();
  config.agents ??= {};
  config.agents.defaults ??= {};
  config.agents.defaults.model ??= {};
  config.agents.defaults.imageModel ??= {};
  assertSafeDefaultModel(config, modelId);
  config.agents.defaults.model.primary = modelId;
  config.agents.defaults.imageModel.primary = modelId;
  await writeOpenClawConfig(config);
  await logActivity({
    action: "model.default.save",
    targetType: "model",
    targetId: modelId,
    status: "succeeded",
    summary: `切换默认模型到 ${modelId}`,
  });
}

export async function testProviderConnectivity(providerId: string) {
  const runtime = await readProviderRuntime(providerId);

  const task = await createTask({
    type: "provider_test",
    title: `测试 Provider ${providerId}`,
    targetType: "provider",
    targetId: providerId,
  });

  await updateTask(task.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    progress: 20,
  });

  try {
    const result = await validateProviderRuntime(runtime);
    const snapshot: ProviderTestSnapshot = {
      lastTestStatus: result.ok ? "ok" : "failed",
      lastTestAt: new Date().toISOString(),
      lastError: result.error,
    };
    await writeProviderTestSnapshot(providerId, snapshot);

    await updateTask(task.id, {
      status: result.ok ? "succeeded" : "failed",
      finishedAt: new Date().toISOString(),
      progress: 100,
      error: result.error,
      summary: result.ok
        ? `真实模型校验成功，HTTP ${result.status}`
        : result.error || `真实模型校验失败，HTTP ${result.status}`,
    });

    await logActivity({
      action: "provider.test",
      targetType: "provider",
      targetId: providerId,
      status: result.ok ? "succeeded" : "failed",
      summary: result.ok
        ? `Provider ${providerId} 真实模型校验成功`
        : result.error || `Provider ${providerId} 测试失败`,
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const snapshot: ProviderTestSnapshot = {
      lastTestStatus: "failed",
      lastTestAt: new Date().toISOString(),
      lastError: message,
    };
    await writeProviderTestSnapshot(providerId, snapshot);
    await updateTask(task.id, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      progress: 100,
      error: message,
      summary: message,
    });
    await logActivity({
      action: "provider.test",
      targetType: "provider",
      targetId: providerId,
      status: "failed",
      summary: message,
    });
    return {
      ok: false,
      status: 0,
      endpoint: runtime.baseUrl,
      modelId: runtime.modelId,
      stages: [],
      modelValidated: false,
      error: message,
    };
  }
}

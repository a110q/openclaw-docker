import { readEnvFile, readOpenClawConfig, resolveEnvTemplate } from './config-files';
import { decryptSecret } from './platform-security';
import { ensurePlatformSchema, getPlatformPool } from './platform-db';
import type { RowDataPacket } from 'mysql2';

export type ProviderKind = 'openai-compatible' | 'anthropic' | 'gemini' | 'ollama';
export type ChatMessageDraft = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

interface ChatRequestInput {
  providerKind: ProviderKind;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  messages: ChatMessageDraft[];
}

interface OpenClawProviderModel {
  id: string;
  name?: string;
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
}

interface ProviderRuntimeRow extends RowDataPacket {
  runtime_provider_id: string;
  runtime_model_ref: string;
  model_id: string;
  base_url: string;
  api_key_encrypted: string;
  type: ProviderKind;
}

export function normalizeProviderKind(providerId: string, api?: string): ProviderKind {
  if (providerId === 'ollama') return 'ollama';
  if (api === 'anthropic-messages') return 'anthropic';
  if (api === 'google-generative-ai') return 'gemini';
  return 'openai-compatible';
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

export function appendVersionedPath(baseUrl: string, nextPath: string) {
  const normalizedBase = trimTrailingSlash(baseUrl);
  const normalizedPath = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function buildChatHttpRequest(input: ChatRequestInput) {
  const filteredMessages = input.messages.filter((item) => item.content.trim());

  if (input.providerKind === 'anthropic') {
    return {
      url: appendVersionedPath(input.baseUrl, '/v1/messages'),
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': input.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: input.modelId,
          max_tokens: 1024,
          messages: filteredMessages.map((item) => ({
            role: item.role === 'assistant' ? 'assistant' : 'user',
            content: item.content,
          })),
        }),
      } satisfies RequestInit,
    };
  }

  if (input.providerKind === 'gemini') {
    return {
      url: `${appendVersionedPath(input.baseUrl, `/v1beta/models/${input.modelId}:generateContent`)}?key=${encodeURIComponent(input.apiKey)}`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: filteredMessages.map((item) => ({
            role: item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: item.content }],
          })),
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024,
          },
        }),
      } satisfies RequestInit,
    };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (input.apiKey) {
    headers.Authorization = `Bearer ${input.apiKey}`;
  }

  return {
    url: appendVersionedPath(input.baseUrl, '/chat/completions'),
    init: {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: input.modelId,
        messages: filteredMessages,
        temperature: 0.4,
        max_tokens: 1024,
      }),
    } satisfies RequestInit,
  };
}

async function resolveSharedProviderRuntime(modelRef: string) {
  const [providerId, modelId] = modelRef.split('/', 2);
  const [config, envState] = await Promise.all([
    readOpenClawConfig<OpenClawConfig>(),
    readEnvFile(),
  ]);
  const provider = config.models?.providers?.[providerId];
  if (!provider) {
    throw new Error(`未找到共享 Provider: ${providerId}`);
  }

  return {
    providerId,
    modelId,
    providerKind: normalizeProviderKind(providerId, provider.api),
    baseUrl: resolveEnvTemplate(provider.baseUrl, envState.values),
    apiKey: resolveEnvTemplate(provider.apiKey || '', envState.values),
  };
}

async function resolvePrivateProviderRuntime(modelRef: string) {
  await ensurePlatformSchema();
  const [rows] = await getPlatformPool().query<ProviderRuntimeRow[]>(
    `SELECT runtime_provider_id, runtime_model_ref, model_id, base_url, api_key_encrypted, type
       FROM platform_providers
      WHERE runtime_model_ref = ?
      LIMIT 1`,
    [modelRef],
  );

  const row = rows[0];
  if (!row) return null;
  return {
    providerId: row.runtime_provider_id,
    modelId: row.model_id,
    providerKind: row.type,
    baseUrl: row.base_url,
    apiKey: decryptSecret(row.api_key_encrypted),
  };
}

async function resolveChatRuntime(modelRef: string) {
  const privateRuntime = await resolvePrivateProviderRuntime(modelRef);
  if (privateRuntime) return privateRuntime;
  return resolveSharedProviderRuntime(modelRef);
}

function extractAssistantText(providerKind: ProviderKind, payload: any) {
  if (providerKind === 'anthropic') {
    return Array.isArray(payload?.content)
      ? payload.content
          .map((item: { type?: string; text?: string }) => (item.type === 'text' ? item.text || '' : ''))
          .join('')
          .trim()
      : '';
  }

  if (providerKind === 'gemini') {
    return Array.isArray(payload?.candidates)
      ? payload.candidates
          .flatMap((candidate: any) => candidate?.content?.parts ?? [])
          .map((part: any) => part?.text || '')
          .join('')
          .trim()
      : '';
  }

  return payload?.choices?.[0]?.message?.content?.trim?.() || '';
}

export async function sendPlatformChatCompletion(input: {
  modelRef: string;
  messages: ChatMessageDraft[];
}) {
  const runtime = await resolveChatRuntime(input.modelRef);
  const request = buildChatHttpRequest({
    providerKind: runtime.providerKind,
    baseUrl: runtime.baseUrl,
    apiKey: runtime.apiKey,
    modelId: runtime.modelId,
    messages: input.messages,
  });

  const response = await fetch(request.url, {
    ...request.init,
    signal: AbortSignal.timeout(45000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    throw new Error(`模型请求失败：${reason}`);
  }

  const content = extractAssistantText(runtime.providerKind, payload);
  if (!content) {
    throw new Error('模型返回为空');
  }

  return {
    content,
    providerKind: runtime.providerKind,
    providerId: runtime.providerId,
    modelId: runtime.modelId,
  };
}

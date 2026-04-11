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

export function getUnsafeAgentModelReason(config: OpenClawConfig, modelId: string) {
  const [providerId, providerModelId] = modelId.split('/', 2);
  if (!providerId || !providerModelId) return '';

  const provider = config.models?.providers?.[providerId];
  const normalizedModelId = providerModelId.trim().toLowerCase();

  if (providerId === 'default' && provider?.api === 'openai-completions' && normalizedModelId.startsWith('glm-')) {
    return 'default/glm-* 当前在 OpenClaw 里容易把工具调用原样吐成文本，不允许绑定为 Agent 主模型。建议改用 claude/claude-sonnet-4-5、gemini/gemini-2.5-pro 或已验证可稳定工具调用的模型。';
  }

  return '';
}

export function assertSafeAgentModel(config: OpenClawConfig, modelId: string) {
  const reason = getUnsafeAgentModelReason(config, modelId);
  if (reason) {
    throw new Error(reason);
  }
}

export function assertSafeDefaultModel(config: OpenClawConfig, modelId: string) {
  const reason = getUnsafeAgentModelReason(config, modelId);
  if (reason) {
    throw new Error(reason.replace('不允许绑定为 Agent 主模型', '不允许设为默认 Agent 模型'));
  }
}

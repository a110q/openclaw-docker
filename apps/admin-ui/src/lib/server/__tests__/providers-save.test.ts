import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  config: {
    models: {
      providers: {
        default: {
          baseUrl: '${OPENAI_COMPATIBLE_BASE_URL}',
          apiKey: '${OPENAI_COMPATIBLE_API_KEY}',
          api: 'openai-completions',
          models: [
            { id: 'kimi-k2.5', name: 'Kimi K2.5', input: ['text', 'image'], contextWindow: 128000 },
            { id: 'glm-5', name: 'GLM 5', input: ['text', 'image'], contextWindow: 128000 }
          ]
        }
      }
    },
    agents: {
      defaults: {
        model: { primary: 'default/kimi-k2.5' },
        imageModel: { primary: 'default/kimi-k2.5' }
      }
    }
  },
  envValues: {
    OPENAI_COMPATIBLE_BASE_URL: 'https://proxy.example/v1',
    OPENAI_COMPATIBLE_API_KEY: 'sk-existing'
  },
  writtenConfig: null as any,
  writtenEnvPatch: null as any,
  metadataCalls: [] as Array<{ providerId: string; metadata: Record<string, unknown> }>,
  activityCalls: [] as Array<Record<string, unknown>>
}));

vi.mock('../config-files', () => ({
  readOpenClawConfig: vi.fn(async () => structuredClone(mockState.config)),
  readEnvFile: vi.fn(async () => ({ entries: [], values: { ...mockState.envValues } })),
  writeOpenClawConfig: vi.fn(async (config) => {
    mockState.writtenConfig = config;
  }),
  writeEnvValues: vi.fn(async (patch) => {
    mockState.writtenEnvPatch = patch;
  }),
  resolveEnvTemplate: vi.fn((value: string | undefined, env: Record<string, string>) => {
    if (!value) return '';
    const match = value.match(/^\$\{([A-Z0-9_]+)\}$/);
    if (!match) return value;
    return env[match[1]] ?? '';
  })
}));

vi.mock('../tasks', () => ({
  createTask: vi.fn(),
  updateTask: vi.fn()
}));

vi.mock('../activity', () => ({
  logActivity: vi.fn(async (payload) => {
    mockState.activityCalls.push(payload);
  })
}));

vi.mock('../settings', () => ({
  deleteProviderMetadata: vi.fn(),
  readProviderMetadataMap: vi.fn(async () => ({})),
  readProviderTestSnapshots: vi.fn(async () => ({})),
  writeProviderMetadata: vi.fn(async (providerId, metadata) => {
    mockState.metadataCalls.push({ providerId, metadata });
  }),
  writeProviderTestSnapshot: vi.fn()
}));

import { saveProvider } from '../providers';

describe('saveProvider', () => {
  beforeEach(() => {
    mockState.writtenConfig = null;
    mockState.writtenEnvPatch = null;
    mockState.metadataCalls = [];
    mockState.activityCalls = [];
  });

  it('preserves existing provider models when a legacy single-model payload adds a new model', async () => {
    await saveProvider({
      id: 'default',
      name: '默认网关',
      type: 'openai-compatible',
      baseUrl: 'https://proxy.example/v1',
      apiKey: '',
      enabled: true,
      isDefault: false,
      modelId: 'codex-5.4',
      modelName: 'Codex 5.4',
      websiteUrl: '',
      notes: '新增 Codex 模型'
    });

    expect(mockState.writtenConfig.models.providers.default.models.map((item: { id: string }) => item.id)).toEqual([
      'kimi-k2.5',
      'glm-5',
      'codex-5.4'
    ]);
    expect(mockState.writtenConfig.models.providers.default.models[2].name).toBe('Codex 5.4');
    expect(mockState.writtenEnvPatch.OPENAI_COMPATIBLE_API_KEY).toBe('sk-existing');
  });
});

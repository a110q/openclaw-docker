import { describe, expect, it } from 'vitest';
import { assertSafeDefaultModel, buildProviderEnvPatch } from '../providers';
import { assertSafeAgentModel } from '../model-policy';

describe('buildProviderEnvPatch', () => {
  it('preserves built-in api key when edit payload leaves it blank', () => {
    const patch = buildProviderEnvPatch(
      'default',
      { baseUrl: 'https://proxy.example/v1', apiKey: '' },
      { OPENAI_COMPATIBLE_API_KEY: 'sk-existing' }
    );

    expect(patch.OPENAI_COMPATIBLE_BASE_URL).toBe('https://proxy.example/v1');
    expect(patch.OPENAI_COMPATIBLE_API_KEY).toBe('sk-existing');
  });
});


describe('assertSafeDefaultModel', () => {
  it('rejects glm default model on openai-compatible default provider', () => {
    expect(() =>
      assertSafeDefaultModel(
        {
          models: {
            providers: {
              default: { api: 'openai-completions', models: [{ id: 'glm-5' }], baseUrl: 'https://example.com' }
            }
          }
        },
        'default/glm-5'
      )
    ).toThrow(/不允许设为默认 Agent 模型/);
  });
});


describe('assertSafeAgentModel', () => {
  it('rejects glm bindings for agent primary model on openai-compatible default provider', () => {
    expect(() =>
      assertSafeAgentModel(
        {
          models: {
            providers: {
              default: { api: 'openai-completions', models: [{ id: 'glm-5' }], baseUrl: 'https://example.com' }
            }
          }
        },
        'default/glm-5'
      )
    ).toThrow(/不允许绑定为 Agent 主模型/);
  });
});

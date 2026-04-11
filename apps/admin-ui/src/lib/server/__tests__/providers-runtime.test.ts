import { describe, expect, it } from 'vitest';
import { applyProviderTestSnapshot } from '../providers';

describe('applyProviderTestSnapshot', () => {
  it('merges saved runtime test state into a provider record', () => {
    const next = applyProviderTestSnapshot(
      {
        id: 'default',
        name: 'default',
        type: 'openai-compatible',
        baseUrl: 'http://example.com',
        apiKeyMasked: 'sk****0000',
        apiKeyConfigured: true,
        enabled: true,
        isDefault: true,
        modelCount: 1,
        defaultModelId: 'gpt-5.4',
        models: [{ id: 'gpt-5.4', name: 'GPT 5.4', capabilities: ['text', 'image'] }],
        lastTestStatus: 'unknown'
      },
      {
        lastTestStatus: 'ok',
        lastTestAt: '2026-04-09T00:00:00.000Z'
      }
    );

    expect(next.lastTestStatus).toBe('ok');
    expect(next.lastTestAt).toBe('2026-04-09T00:00:00.000Z');
  });
});

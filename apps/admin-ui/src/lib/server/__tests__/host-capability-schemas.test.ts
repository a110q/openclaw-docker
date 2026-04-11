import { describe, expect, it } from 'vitest';
import {
  hostCapabilityExecuteSchema,
  hostCapabilityPreviewSchema
} from '@/lib/schemas/host-capabilities';

describe('host capability schemas', () => {
  it('accepts valid preview payloads for supported capability ids', () => {
    const logsPreview = hostCapabilityPreviewSchema.parse({
      capabilityId: 'host.compose.logs',
      input: { service: 'openclaw-gateway', tail: 80 }
    });

    const providerPreview = hostCapabilityPreviewSchema.parse({
      capabilityId: 'host.provider.upsert',
      input: {
        id: 'default',
        name: 'Default Provider',
        type: 'openai-compatible',
        baseUrl: 'https://proxy.example/v1',
        apiKey: '',
        enabled: true,
        isDefault: true,
        modelId: 'gpt-5.4',
        modelName: 'GPT 5.4'
      }
    });

    const feishuPreview = hostCapabilityPreviewSchema.parse({
      capabilityId: 'host.alert.feishu.upsert',
      input: {
        id: 'feishu-main',
        name: '主通道',
        webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/test',
        secret: '',
        enabled: true,
        minLevel: 'warning'
      }
    });

    expect(logsPreview.capabilityId).toBe('host.compose.logs');
    expect(providerPreview.capabilityId).toBe('host.provider.upsert');
    expect(feishuPreview.capabilityId).toBe('host.alert.feishu.upsert');
  });

  it('requires explicit confirmation for dangerous execute payloads and rejects unknown capabilities', () => {
    expect(() =>
      hostCapabilityExecuteSchema.parse({
        capabilityId: 'host.service.recreateGateway',
        input: {},
        confirmed: true
      })
    ).not.toThrow();

    expect(() =>
      hostCapabilityExecuteSchema.parse({
        capabilityId: 'host.unknown',
        input: {}
      })
    ).toThrow();
  });
});

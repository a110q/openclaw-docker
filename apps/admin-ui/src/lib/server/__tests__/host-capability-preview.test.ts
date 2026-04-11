import { describe, expect, it } from 'vitest';
import { previewHostCapability } from '../host-capabilities/preview';

describe('previewHostCapability', () => {
  it('builds a read-only preview for compose status', async () => {
    const preview = await previewHostCapability({
      capabilityId: 'host.compose.ps',
      input: {}
    });

    expect(preview).toMatchObject({
      capabilityId: 'host.compose.ps',
      riskLevel: 'read',
      requiresConfirmation: false,
      impact: 'restart'
    });
    expect(preview.summary).toMatch(/Docker Compose/);
  });

  it('builds change previews for provider, feishu and recreate actions', async () => {
    const providerPreview = await previewHostCapability({
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

    const feishuPreview = await previewHostCapability({
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

    const recreatePreview = await previewHostCapability({
      capabilityId: 'host.service.recreateGateway',
      input: {}
    });

    expect(providerPreview.impact).toBe('force-recreate');
    expect(providerPreview.changes.some((item) => item.field === 'models.providers')).toBe(true);
    expect(feishuPreview.changes.some((item) => item.field === 'alerts.channels')).toBe(true);
    expect(recreatePreview.requiresConfirmation).toBe(true);
    expect(recreatePreview.riskLevel).toBe('danger');
  });
});

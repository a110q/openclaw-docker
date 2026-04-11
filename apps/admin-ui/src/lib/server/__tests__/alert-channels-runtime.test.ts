import { describe, expect, it } from 'vitest';
import { mergeAlertChannelDraft } from '../alerts';

describe('mergeAlertChannelDraft', () => {
  it('keeps existing secret when editing and secret input is blank', () => {
    const merged = mergeAlertChannelDraft(
      {
        id: 'feishu-main',
        type: 'feishu-webhook',
        name: '主通道',
        enabled: true,
        webhookMasked: 'https://open.feishu.cn/...',
        webhookUrl: 'https://open.feishu.cn/hook/abc',
        secretConfigured: true,
        secret: 'old-secret',
        minLevel: 'warning',
        lastTestStatus: 'unknown'
      },
      {
        id: 'feishu-main',
        name: '主通道-新',
        webhookUrl: 'https://open.feishu.cn/hook/abc',
        secret: '',
        enabled: true,
        minLevel: 'critical'
      }
    );

    expect(merged.name).toBe('主通道-新');
    expect(merged.secret).toBe('old-secret');
    expect(merged.secretConfigured).toBe(true);
  });
});

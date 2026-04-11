import { describe, expect, it } from 'vitest';
import { parseRecentFeishuActivity, summarizeFeishuDiscovery } from '../feishu-discovery';

describe('summarizeFeishuDiscovery', () => {
  it('discovers feishu bot accounts, group bindings and dm bindings from openclaw config', () => {
    const snapshot = summarizeFeishuDiscovery(
      {
        channels: {
          feishu: {
            enabled: true,
            connectionMode: 'websocket',
            defaultAccount: 'default',
            accounts: {
              default: { appId: 'cli_123456', name: 'OpenClaw Bot' }
            },
            groups: {
              oc_backend_group_id: { enabled: true, requireMention: true }
            },
            allowFrom: ['ou_user_1'],
            dmAllowFrom: ['ou_user_1']
          }
        },
        bindings: [
          {
            agentId: 'backend',
            match: { channel: 'feishu', peer: { kind: 'group', id: 'oc_backend_group_id' } }
          },
          {
            agentId: 'default',
            match: { channel: 'feishu', peer: { kind: 'direct', id: 'ou_user_1' } }
          }
        ]
      },
      [
        {
          id: 'feishu-main',
          type: 'feishu-webhook',
          name: '生产告警',
          enabled: true,
          webhookMasked: 'https://open.feishu.cn/...',
          webhookUrl: 'https://open.feishu.cn/hook/abc',
          secretConfigured: false,
          minLevel: 'warning',
          lastTestStatus: 'unknown'
        }
      ],
      '2026-04-10T06:00:00.000Z'
    );

    expect(snapshot.managedAlertChannels).toBe(1);
    expect(snapshot.botAccounts).toBe(1);
    expect(snapshot.groupBindings).toBe(1);
    expect(snapshot.dmBindings).toBe(1);
    expect(snapshot.items.map((item) => item.kind)).toEqual(['bot-account', 'group-binding', 'dm-binding']);
    expect(snapshot.items[0]).toMatchObject({
      title: 'OpenClaw Bot',
      status: 'managed'
    });
    expect(snapshot.items[1]).toMatchObject({
      title: '群通道 · backend',
      agentId: 'backend',
      peerId: 'oc_backend_group_id',
      requireMention: true
    });
    expect(snapshot.items[2]).toMatchObject({
      title: '私聊通道 · default',
      agentId: 'default',
      peerId: 'ou_user_1',
      enabled: true
    });
  });

  it('flags legacy p2p bindings as warning items while still surfacing them', () => {
    const snapshot = summarizeFeishuDiscovery(
      {
        channels: {
          feishu: {
            enabled: true,
            accounts: { default: { appId: 'cli_legacy', name: 'Legacy Bot' } },
            allowFrom: [],
            dmAllowFrom: []
          }
        },
        bindings: [
          {
            agentId: 'default',
            match: { channel: 'feishu', peer: { kind: 'p2p', id: 'ou_legacy' } }
          }
        ]
      },
      [],
      '2026-04-10T06:00:00.000Z'
    );

    expect(snapshot.warnings).toBe(1);
    expect(snapshot.dmBindings).toBe(1);
    expect(snapshot.items[1]).toMatchObject({
      kind: 'dm-binding',
      status: 'warning',
      bindingKind: 'p2p'
    });
  });

  it('marks recent message activity on the matched account and channel bindings', () => {
    const activity = parseRecentFeishuActivity([
      '2026-04-10T05:58:20.000Z [feishu] feishu[default]: received message from ou_user_9 in oc_frontend_group_id (group)',
      '2026-04-10T05:59:40.000Z [feishu] feishu[default]: received message from ou_user_1 in oc_dm_chat_1 (p2p)',
      '2026-04-10T05:59:41.000Z [feishu] feishu[default]: Feishu[default] DM from ou_user_1: 你现在是什么模型'
    ].join('\n'), '2026-04-10T06:00:00.000Z');

    const snapshot = summarizeFeishuDiscovery(
      {
        channels: {
          feishu: {
            enabled: true,
            defaultAccount: 'default',
            accounts: {
              default: { appId: 'cli_123456', name: 'OpenClaw Bot' }
            },
            groups: {
              oc_frontend_group_id: { enabled: true, requireMention: false }
            },
            allowFrom: ['ou_user_1'],
            dmAllowFrom: ['ou_user_1']
          }
        },
        bindings: [
          {
            agentId: 'frontend',
            match: { channel: 'feishu', peer: { kind: 'group', id: 'oc_frontend_group_id' } }
          },
          {
            agentId: 'default',
            match: { channel: 'feishu', peer: { kind: 'direct', id: 'ou_user_1' } }
          }
        ]
      },
      [],
      '2026-04-10T06:00:00.000Z',
      activity
    );

    expect(snapshot.items[0]).toMatchObject({ active: true });
    expect(snapshot.items[1]).toMatchObject({ active: true, lastActivityAt: '2026-04-10T05:58:20.000Z' });
    expect(snapshot.items[2]).toMatchObject({ active: true, lastActivityAt: '2026-04-10T05:59:40.000Z' });
    expect(snapshot.items[2].recentMessages?.[0]).toMatchObject({
      text: '你现在是什么模型'
    });
  });
});

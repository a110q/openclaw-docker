import { describe, expect, it } from 'vitest';
import { deleteFeishuBindingInConfig, upsertFeishuBindingInConfig } from '../feishu-binding-admin';

describe('upsertFeishuBindingInConfig', () => {
  it('updates an existing group binding and group settings', () => {
    const next = upsertFeishuBindingInConfig(
      {
        channels: {
          feishu: {
            groups: {
              oc_backend_group_id: { enabled: true, requireMention: true }
            }
          }
        },
        bindings: [
          {
            agentId: 'backend',
            match: { channel: 'feishu', peer: { kind: 'group', id: 'oc_backend_group_id' } }
          }
        ]
      },
      {
        kind: 'group-binding',
        peerId: 'oc_backend_group_id',
        agentId: 'frontend',
        enabled: false,
        requireMention: false
      }
    );

    expect((next.channels?.feishu?.groups as Record<string, { enabled?: boolean; requireMention?: boolean }>).oc_backend_group_id).toEqual({
      enabled: false,
      requireMention: false
    });
    expect(next.bindings?.[0]).toMatchObject({
      agentId: 'frontend',
      match: { peer: { kind: 'group', id: 'oc_backend_group_id' } }
    });
  });

  it('upserts dm binding and syncs allowFrom lists', () => {
    const next = upsertFeishuBindingInConfig(
      {
        channels: {
          feishu: {
            allowFrom: [],
            dmAllowFrom: []
          }
        },
        bindings: []
      },
      {
        kind: 'dm-binding',
        peerId: 'ou_user_1',
        agentId: 'default',
        enabled: true,
        bindingKind: 'direct'
      }
    );

    expect(next.channels?.feishu?.allowFrom).toContain('ou_user_1');
    expect(next.channels?.feishu?.dmAllowFrom).toContain('ou_user_1');
    expect(next.bindings?.[0]).toMatchObject({
      agentId: 'default',
      match: { peer: { kind: 'direct', id: 'ou_user_1' } }
    });
  });
});

describe('deleteFeishuBindingInConfig', () => {
  it('removes group binding and group metadata together', () => {
    const next = deleteFeishuBindingInConfig(
      {
        channels: {
          feishu: {
            groups: {
              oc_backend_group_id: { enabled: true, requireMention: true }
            }
          }
        },
        bindings: [
          {
            agentId: 'backend',
            match: { channel: 'feishu', peer: { kind: 'group', id: 'oc_backend_group_id' } }
          }
        ]
      },
      {
        kind: 'group-binding',
        peerId: 'oc_backend_group_id'
      }
    );

    expect(next.bindings).toEqual([]);
    expect((next.channels?.feishu?.groups as Record<string, unknown>).oc_backend_group_id).toBeUndefined();
  });
});

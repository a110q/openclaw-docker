import { describe, expect, it } from 'vitest';
import {
  buildPlatformClawSwarmRuntimeAgentDirectory,
  filterPlatformClawSwarmConversationsForLobsters,
} from '../platform-clawswarm-chat';

describe('platform-clawswarm-chat helpers', () => {
  it('flattens address-book instances into runtime agent directory', () => {
    const directory = buildPlatformClawSwarmRuntimeAgentDirectory([
      {
        id: 1,
        name: 'OpenClaw Gateway',
        status: 'active',
        agents: [
          {
            id: 7,
            agent_key: 'lobster_50bfae82_4126d2dd',
            cs_id: 'CSA-0007',
            display_name: '小龙虾船长 的龙虾',
            role_name: null,
            enabled: true,
          },
        ],
      },
    ]);

    expect(directory).toEqual([
      {
        id: 7,
        instanceId: 1,
        instanceName: 'OpenClaw Gateway',
        instanceStatus: 'active',
        agentKey: 'lobster_50bfae82_4126d2dd',
        csId: 'CSA-0007',
        displayName: '小龙虾船长 的龙虾',
        roleName: undefined,
        enabled: true,
      },
    ]);
  });

  it('keeps only current user lobster conversations and annotates runtime link', () => {
    const directory = buildPlatformClawSwarmRuntimeAgentDirectory([
      {
        id: 1,
        name: 'OpenClaw Gateway',
        status: 'active',
        agents: [
          {
            id: 7,
            agent_key: 'lobster_50bfae82_4126d2dd',
            cs_id: 'CSA-0007',
            display_name: '小龙虾船长 的龙虾',
            role_name: null,
            enabled: true,
          },
          {
            id: 3,
            agent_key: 'frontend',
            cs_id: 'CSA-0003',
            display_name: 'Frontend',
            role_name: null,
            enabled: true,
          },
        ],
      },
    ]);

    const conversations = filterPlatformClawSwarmConversationsForLobsters({
      publicBaseUrl: 'http://localhost:18080',
      agents: directory,
      lobsters: [
        {
          id: '4126d2dd-ship',
          name: '小龙虾船长 的龙虾',
          archetype: '默认原型',
          modelRef: 'default/gpt-5.4',
          runtimeAgentId: 'lobster_50bfae82_4126d2dd',
          runtimeSyncStatus: 'synced',
        },
      ],
      conversations: [
        {
          id: 7,
          type: 'direct',
          title: 'OpenClaw Gateway / 小龙虾船长 的龙虾',
          group_id: null,
          direct_instance_id: 1,
          direct_agent_id: 7,
          display_title: 'OpenClaw Gateway / 小龙虾船长 的龙虾',
          group_name: null,
          instance_name: 'OpenClaw Gateway',
          agent_display_name: '小龙虾船长 的龙虾',
          last_message_id: 'msg_1',
          last_message_preview: '收到',
          last_message_sender_type: 'agent',
          last_message_sender_label: '小龙虾船长 的龙虾',
          last_message_at: '2026-04-11T10:36:58.751Z',
          last_message_status: 'completed',
          created_at: '2026-04-11T10:11:10.663Z',
          updated_at: '2026-04-11T10:36:58.772Z',
        },
        {
          id: 3,
          type: 'direct',
          title: 'OpenClaw Gateway / Frontend',
          group_id: null,
          direct_instance_id: 1,
          direct_agent_id: 3,
          display_title: 'OpenClaw Gateway / Frontend',
          group_name: null,
          instance_name: 'OpenClaw Gateway',
          agent_display_name: 'Frontend',
          last_message_id: 'msg_2',
          last_message_preview: 'not mine',
          last_message_sender_type: 'user',
          last_message_sender_label: 'User',
          last_message_at: '2026-04-11T10:12:00.000Z',
          last_message_status: 'completed',
          created_at: '2026-04-11T10:11:08.580Z',
          updated_at: '2026-04-11T10:12:00.000Z',
        },
      ],
    });

    expect(conversations).toHaveLength(1);
    expect(conversations[0]).toMatchObject({
      id: 7,
      lobsterId: '4126d2dd-ship',
      lobsterName: '小龙虾船长 的龙虾',
      agentKey: 'lobster_50bfae82_4126d2dd',
      externalUrl: 'http://localhost:18080/messages/conversation/7',
      lastMessagePreview: '收到',
    });
  });
});

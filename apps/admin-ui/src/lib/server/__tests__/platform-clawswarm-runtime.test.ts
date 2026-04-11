import { describe, expect, it } from 'vitest';
import {
  derivePlatformClawSwarmTasks,
  mergePlatformClawSwarmInstances,
  normalizePlatformClawSwarmTaskStatus,
} from '../platform-clawswarm-runtime';

describe('platform-clawswarm-runtime helpers', () => {
  it('merges instance health and address book agent counts', () => {
    const merged = mergePlatformClawSwarmInstances({
      instances: [
        {
          id: 1,
          instance_key: 'instance-001',
          name: '本地 OpenClaw',
          channel_base_url: 'http://openclaw-gateway:18789',
          channel_account_id: 'default',
          status: 'active',
          created_at: '2026-04-11T00:00:00.000Z',
          updated_at: '2026-04-11T00:00:00.000Z',
        },
      ],
      health: [{ id: 1, status: 'active' }],
      addressBookInstances: [
        {
          id: 1,
          name: '本地 OpenClaw',
          status: 'active',
          agents: [
            {
              id: 11,
              agent_key: 'agent-alpha',
              cs_id: 'CSA-001',
              display_name: '分析龙虾',
              role_name: '分析师',
              enabled: true,
            },
            {
              id: 12,
              agent_key: 'agent-beta',
              cs_id: 'CSA-002',
              display_name: '执行龙虾',
              role_name: '执行者',
              enabled: false,
            },
          ],
        },
      ],
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]?.runtimeStatus).toBe('active');
    expect(merged[0]?.agentCount).toBe(2);
    expect(merged[0]?.enabledAgentCount).toBe(1);
  });

  it('normalizes dialogue status to platform task status', () => {
    expect(normalizePlatformClawSwarmTaskStatus('running')).toBe('running');
    expect(normalizePlatformClawSwarmTaskStatus('completed')).toBe('succeeded');
    expect(normalizePlatformClawSwarmTaskStatus('failed')).toBe('failed');
    expect(normalizePlatformClawSwarmTaskStatus('paused')).toBe('pending');
  });

  it('derives platform task cards from agent dialogue conversations', () => {
    const tasks = derivePlatformClawSwarmTasks([
      {
        id: 7,
        type: 'agent_dialogue',
        displayTitle: '分析龙虾 ↔ 执行龙虾',
        dialogueSourceAgentName: '分析龙虾',
        dialogueTargetAgentName: '执行龙虾',
        dialogueStatus: 'running',
        lastMessagePreview: '正在同步最新上下文',
        lastMessageAt: '2026-04-11T01:00:00.000Z',
        createdAt: '2026-04-11T00:59:00.000Z',
        updatedAt: '2026-04-11T01:00:00.000Z',
      },
      {
        id: 8,
        type: 'direct',
        displayTitle: '普通直聊',
        createdAt: '2026-04-11T00:59:00.000Z',
        updatedAt: '2026-04-11T01:00:00.000Z',
      },
    ]);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: 'conversation-7',
      conversationId: 7,
      status: 'running',
      sourceAgentName: '分析龙虾',
      targetAgentName: '执行龙虾',
    });
  });
});

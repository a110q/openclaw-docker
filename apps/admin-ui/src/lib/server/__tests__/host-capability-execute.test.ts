import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  taskCounter: 0,
  activityCounter: 0,
  tasks: [] as Array<Record<string, any>>,
  activities: [] as Array<Record<string, any>>,
  inspectComposeServices: vi.fn(),
  readComposeLogs: vi.fn(),
  runComposeActionTask: vi.fn(),
  saveProvider: vi.fn(),
  saveAlertChannel: vi.fn()
}));

vi.mock('@/lib/server/compose', () => ({
  inspectComposeServices: mockState.inspectComposeServices,
  readComposeLogs: mockState.readComposeLogs,
  runComposeActionTask: mockState.runComposeActionTask
}));

vi.mock('@/lib/server/providers', () => ({
  saveProvider: mockState.saveProvider
}));

vi.mock('@/lib/server/alerts', () => ({
  saveAlertChannel: mockState.saveAlertChannel
}));

vi.mock('@/lib/server/tasks', () => ({
  createTask: vi.fn(async (input: Record<string, any>) => {
    mockState.taskCounter += 1;
    const task = {
      id: `task-${mockState.taskCounter}`,
      status: 'pending',
      createdAt: '2026-04-09T00:00:00.000Z',
      logs: [],
      ...input
    };
    mockState.tasks.unshift(task);
    return task;
  }),
  updateTask: vi.fn(async (taskId: string, patch: Record<string, any>) => {
    const index = mockState.tasks.findIndex((task) => task.id === taskId);
    if (index < 0) throw new Error(`Task not found: ${taskId}`);
    mockState.tasks[index] = { ...mockState.tasks[index], ...patch };
    return mockState.tasks[index];
  }),
  appendTaskLog: vi.fn(async (taskId: string, message: string) => {
    const index = mockState.tasks.findIndex((task) => task.id === taskId);
    if (index < 0) throw new Error(`Task not found: ${taskId}`);
    mockState.tasks[index] = {
      ...mockState.tasks[index],
      logs: [...mockState.tasks[index].logs, message]
    };
    return mockState.tasks[index];
  }),
  getTask: vi.fn(async (taskId: string) => mockState.tasks.find((task) => task.id === taskId))
}));

vi.mock('@/lib/server/activity', () => ({
  logActivity: vi.fn(async (input: Record<string, any>) => {
    mockState.activityCounter += 1;
    const activity = {
      id: `activity-${mockState.activityCounter}`,
      createdAt: '2026-04-09T00:00:00.000Z',
      ...input
    };
    mockState.activities.unshift(activity);
    return activity;
  })
}));

import { executeHostCapability } from '../host-capabilities/execute';

describe('executeHostCapability', () => {
  beforeEach(() => {
    mockState.taskCounter = 0;
    mockState.activityCounter = 0;
    mockState.tasks = [];
    mockState.activities = [];
    mockState.inspectComposeServices.mockReset();
    mockState.readComposeLogs.mockReset();
    mockState.runComposeActionTask.mockReset();
    mockState.saveProvider.mockReset();
    mockState.saveAlertChannel.mockReset();
  });

  it('returns compose status data and writes audit records for host.compose.ps', async () => {
    mockState.inspectComposeServices.mockResolvedValue([
      { Service: 'openclaw-gateway', State: 'running', Health: 'healthy' }
    ]);

    const result = await executeHostCapability({
      capabilityId: 'host.compose.ps',
      input: {}
    });

    expect(result.status).toBe('succeeded');
    expect(result.result).toEqual([
      { Service: 'openclaw-gateway', State: 'running', Health: 'healthy' }
    ]);
    expect(mockState.tasks).toHaveLength(1);
    expect(mockState.tasks[0]?.status).toBe('succeeded');
    expect(mockState.activities[0]).toMatchObject({
      action: 'host.capability.execute',
      status: 'succeeded',
      targetId: 'host.compose.ps'
    });
  });

  it('returns compose logs for host.compose.logs', async () => {
    mockState.readComposeLogs.mockResolvedValue('gateway log line');

    const result = await executeHostCapability({
      capabilityId: 'host.compose.logs',
      input: { service: 'openclaw-gateway', tail: 80 }
    });

    expect(mockState.readComposeLogs).toHaveBeenCalledWith('openclaw-gateway', 80);
    expect(result.result).toBe('gateway log line');
    expect(result.logs.length).toBeGreaterThan(0);
  });

  it('dispatches provider and feishu write capabilities through existing helpers', async () => {
    mockState.saveProvider.mockResolvedValue({ id: 'provider-main', name: 'Provider Main' });
    mockState.saveAlertChannel.mockResolvedValue({ id: 'feishu-main', name: '主通道' });

    const providerResult = await executeHostCapability({
      capabilityId: 'host.provider.upsert',
      input: {
        id: 'provider-main',
        name: 'Provider Main',
        type: 'openai-compatible',
        baseUrl: 'https://proxy.example/v1',
        apiKey: '',
        enabled: true,
        isDefault: true,
        modelId: 'gpt-5.4',
        modelName: 'GPT 5.4'
      },
      confirmed: true
    });

    const channelResult = await executeHostCapability({
      capabilityId: 'host.alert.feishu.upsert',
      input: {
        id: 'feishu-main',
        name: '主通道',
        webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/test',
        secret: '',
        enabled: true,
        minLevel: 'warning'
      },
      confirmed: true
    });

    expect(mockState.saveProvider).toHaveBeenCalledTimes(1);
    expect(mockState.saveAlertChannel).toHaveBeenCalledTimes(1);
    expect(providerResult.result).toMatchObject({ id: 'provider-main' });
    expect(channelResult.result).toMatchObject({ id: 'feishu-main' });
  });

  it('rejects dangerous capability execution without confirmation and still audits the attempt', async () => {
    await expect(
      executeHostCapability({
        capabilityId: 'host.service.recreateGateway',
        input: {},
        confirmed: false
      })
    ).rejects.toThrow(/confirmation/i);

    expect(mockState.runComposeActionTask).not.toHaveBeenCalled();
    expect(mockState.tasks).toHaveLength(1);
    expect(mockState.tasks[0]?.status).toBe('failed');
    expect(mockState.activities[0]).toMatchObject({
      action: 'host.capability.execute',
      status: 'failed',
      targetId: 'host.service.recreateGateway'
    });
  });
});

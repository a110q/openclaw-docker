import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  createTask: vi.fn(),
  getTask: vi.fn(),
  runPlatformClawSwarmSyncTask: vi.fn(),
}));

vi.mock('@/lib/server/tasks', () => ({
  createTask: mockState.createTask,
  getTask: mockState.getTask,
}));

vi.mock('@/lib/server/platform-clawswarm-sync', () => ({
  runPlatformClawSwarmSyncTask: mockState.runPlatformClawSwarmSyncTask,
}));

import { POST as syncRoute } from '@/app/api/admin/v1/clawswarm/sync/route';

describe('platform clawswarm sync route', () => {
  beforeEach(() => {
    mockState.createTask.mockReset();
    mockState.getTask.mockReset();
    mockState.runPlatformClawSwarmSyncTask.mockReset();
  });

  it('creates a task and returns the latest sync result', async () => {
    mockState.createTask.mockResolvedValue({
      id: 'task-sync-1',
      type: 'clawswarm_sync',
      title: 'ClawSwarm 手动同步',
      targetType: 'runtime',
      targetId: 'clawswarm',
      status: 'pending',
      createdAt: '2026-04-11T14:30:00.000Z',
      logs: [],
    });
    mockState.runPlatformClawSwarmSyncTask.mockResolvedValue(undefined);
    mockState.getTask.mockResolvedValue({
      id: 'task-sync-1',
      type: 'clawswarm_sync',
      title: 'ClawSwarm 手动同步',
      targetType: 'runtime',
      targetId: 'clawswarm',
      status: 'succeeded',
      createdAt: '2026-04-11T14:30:00.000Z',
      finishedAt: '2026-04-11T14:30:05.000Z',
      summary: '已同步 1 个实例，ClawSwarm 通讯录已刷新。',
      logs: ['done'],
    });

    const response = await syncRoute();
    const body = await response.json();

    expect(mockState.createTask).toHaveBeenCalledWith({
      type: 'clawswarm_sync',
      title: 'ClawSwarm 手动同步',
      targetType: 'runtime',
      targetId: 'clawswarm',
    });
    expect(mockState.runPlatformClawSwarmSyncTask).toHaveBeenCalledWith('task-sync-1');
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({
      id: 'task-sync-1',
      status: 'succeeded',
      summary: '已同步 1 个实例，ClawSwarm 通讯录已刷新。',
    });
  });
});

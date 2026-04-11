import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('platform-clawswarm-sync', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env.OPENCLAW_CLAWSWARM_ENABLED = 'true';
    process.env.OPENCLAW_CLAWSWARM_INTERNAL_URL = 'http://clawswarm.local:18080';
    process.env.OPENCLAW_CLAWSWARM_USERNAME = 'admin';
    process.env.OPENCLAW_CLAWSWARM_PASSWORD = 'admin123456';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('logs in and syncs every ClawSwarm instance', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 'u1', username: 'admin', display_name: 'admin', using_default_password: true }),
          { status: 200, headers: { 'set-cookie': 'session=abc; Path=/; HttpOnly' } },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1, status: 'active' }, { id: 9, status: 'disabled' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const { syncPlatformClawSwarmInstances } = await import('../platform-clawswarm-sync');
    const result = await syncPlatformClawSwarmInstances();

    expect(result).toEqual({
      skipped: false,
      totalInstances: 2,
      syncedInstanceIds: [1, 9],
      failedInstanceIds: [],
      errorMessages: [],
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://clawswarm.local:18080/api/auth/login');
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://clawswarm.local:18080/api/instances');
    expect(fetchMock.mock.calls[2]?.[0]).toBe('http://clawswarm.local:18080/api/instances/1/sync-agents');
    expect(fetchMock.mock.calls[3]?.[0]).toBe('http://clawswarm.local:18080/api/instances/9/sync-agents');
  });

  it('skips syncing when ClawSwarm is disabled', async () => {
    process.env.OPENCLAW_CLAWSWARM_ENABLED = 'false';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { syncPlatformClawSwarmInstances } = await import('../platform-clawswarm-sync');
    const result = await syncPlatformClawSwarmInstances();

    expect(result.skipped).toBe(true);
    expect(result.syncedInstanceIds).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

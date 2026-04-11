import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  listHostCapabilities: vi.fn(),
  previewHostCapability: vi.fn(),
  executeHostCapability: vi.fn()
}));

vi.mock('@/lib/server/host-capabilities/registry', () => ({
  listHostCapabilities: mockState.listHostCapabilities
}));

vi.mock('@/lib/server/host-capabilities/preview', () => ({
  previewHostCapability: mockState.previewHostCapability
}));

vi.mock('@/lib/server/host-capabilities/execute', () => ({
  executeHostCapability: mockState.executeHostCapability
}));

import { GET as listRoute } from '@/app/api/admin/v1/host-capabilities/route';
import { POST as previewRoute } from '@/app/api/admin/v1/host-capabilities/preview/route';
import { POST as executeRoute } from '@/app/api/admin/v1/host-capabilities/execute/route';

describe('host capability routes contract', () => {
  beforeEach(() => {
    mockState.listHostCapabilities.mockReset();
    mockState.previewHostCapability.mockReset();
    mockState.executeHostCapability.mockReset();
  });

  it('returns the capability catalog from GET /host-capabilities', async () => {
    mockState.listHostCapabilities.mockReturnValue([
      { id: 'host.compose.ps', title: '读取 Compose 服务状态', riskLevel: 'read', requiresConfirmation: false }
    ]);

    const response = await listRoute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: [{ id: 'host.compose.ps', title: '读取 Compose 服务状态', riskLevel: 'read', requiresConfirmation: false }]
    });
  });

  it('returns preview payload from POST /host-capabilities/preview', async () => {
    mockState.previewHostCapability.mockResolvedValue({
      capabilityId: 'host.compose.logs',
      title: '读取 Compose 服务日志',
      summary: '读取最近日志。',
      impact: 'restart',
      changes: [],
      requiresConfirmation: false,
      riskLevel: 'read'
    });

    const response = await previewRoute(
      new Request('http://localhost/api/admin/v1/host-capabilities/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capabilityId: 'host.compose.logs',
          input: { service: 'openclaw-gateway', tail: 50 }
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({ capabilityId: 'host.compose.logs', summary: '读取最近日志。' });
  });

  it('returns taskId and result from POST /host-capabilities/execute', async () => {
    mockState.executeHostCapability.mockResolvedValue({
      taskId: 'task-1',
      capabilityId: 'host.provider.upsert',
      status: 'succeeded',
      summary: '已保存 Provider provider-main',
      result: { id: 'provider-main' },
      logs: ['done']
    });

    const response = await executeRoute(
      new Request('http://localhost/api/admin/v1/host-capabilities/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toMatchObject({
      taskId: 'task-1',
      status: 'succeeded',
      result: { id: 'provider-main' }
    });
  });

  it('returns 400 for unsupported capability ids', async () => {
    const response = await previewRoute(
      new Request('http://localhost/api/admin/v1/host-capabilities/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capabilityId: 'host.unknown', input: {} })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
  });
});

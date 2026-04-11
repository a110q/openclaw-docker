import { describe, expect, it } from 'vitest';
import {
  buildPlatformSwarmMemberRef,
  buildPlatformSwarmTenantKey,
  derivePlatformClawSwarmServiceStatus,
  derivePlatformSwarmMemberSummary,
} from '../platform-clawswarm';

describe('platform-clawswarm helpers', () => {
  it('builds stable tenant and member refs from ids', () => {
    expect(buildPlatformSwarmTenantKey('50bfae82-9376-40b2-89da-9f56e14dfbf3')).toBe('tenant_50bfae82');
    expect(buildPlatformSwarmMemberRef('ae2d87c7-0336-4e7d-a8de-a4c611dac0d6')).toBe('swarm_member_ae2d87c7');
  });

  it('marks the service unhealthy when compose is running but health probing fails', () => {
    const result = derivePlatformClawSwarmServiceStatus({
      enabled: true,
      composeItem: { Service: 'openclaw-clawswarm', State: 'running', Health: '' },
      reachable: false,
      internalUrl: 'http://openclaw-clawswarm:18080',
      publicUrl: 'http://localhost:18080',
      error: 'connect ECONNREFUSED',
    });

    expect(result.status).toBe('running');
    expect(result.health).toBe('unhealthy');
    expect(result.diagnostics.join('\n')).toContain('connect ECONNREFUSED');
  });

  it('derives member sync status from the platform lobster runtime state', () => {
    const summary = derivePlatformSwarmMemberSummary({
      lobster: {
        id: 'lobster-001',
        userId: 'user-001',
        name: '测试龙虾',
        archetype: '分析型',
        modelRef: 'default/gpt-5.4',
        runtimeAgentId: 'lobster_user001_l001',
        runtimeSyncStatus: 'failed',
        runtimeSyncError: 'runtime missing',
        isDefault: true,
        createdAt: '2026-04-11T00:00:00.000Z',
        updatedAt: '2026-04-11T00:00:00.000Z',
      },
    });

    expect(summary.syncStatus).toBe('failed');
    expect(summary.syncError).toBe('runtime missing');
    expect(summary.swarmMemberRef).toBe('swarm_member_lobster-');
  });
});

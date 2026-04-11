import { describe, expect, it } from 'vitest';
import { getHostCapability, listHostCapabilities } from '../host-capabilities/registry';

describe('host capability registry', () => {
  it('exposes the phase 1 capability catalog with metadata', () => {
    const capabilities = listHostCapabilities();

    expect(capabilities).toHaveLength(5);
    expect(capabilities.map((item) => item.id)).toEqual([
      'host.compose.ps',
      'host.compose.logs',
      'host.provider.upsert',
      'host.alert.feishu.upsert',
      'host.service.recreateGateway'
    ]);

    expect(getHostCapability('host.compose.ps')).toMatchObject({
      id: 'host.compose.ps',
      riskLevel: 'read',
      requiresConfirmation: false
    });

    expect(getHostCapability('host.service.recreateGateway')).toMatchObject({
      id: 'host.service.recreateGateway',
      riskLevel: 'danger',
      requiresConfirmation: true
    });
  });
});

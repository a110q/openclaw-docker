import { describe, expect, it } from 'vitest';
import { summarizeNetworkPolicySnapshot } from '../network-policy';

describe('summarizeNetworkPolicySnapshot', () => {
  it('marks auto mode as direct when proxy probe fails', () => {
    const next = summarizeNetworkPolicySnapshot(
      {
        mode: 'auto',
        decision: 'direct',
        reason: 'auto_fallback_direct',
        updatedAt: '2026-04-10T04:34:35.381Z',
        configured: { HTTP_PROXY: 'http://host.docker.internal:7890' },
        effective: {},
        probes: [{ url: 'http://host.docker.internal:7890', ok: false, error: 'connect ECONNREFUSED 192.168.65.254:7890' }]
      },
      {
        network: 'bridge',
        extraHosts: ['host.docker.internal:host-gateway']
      }
    );

    expect(next.mode).toBe('auto');
    expect(next.decision).toBe('direct');
    expect(next.reason).toContain('自动回退');
    expect(next.configuredProxy).toBe('http://host.docker.internal:7890');
    expect(next.effectiveProxy).toBe('');
    expect(next.sandboxUsesProxy).toBe(false);
  });

  it('marks proxy mode when effective sandbox proxy exists', () => {
    const next = summarizeNetworkPolicySnapshot(
      {
        mode: 'auto',
        decision: 'proxy',
        reason: 'proxy_reachable',
        configured: { HTTPS_PROXY: 'http://host.docker.internal:7890' },
        effective: { HTTPS_PROXY: 'http://host.docker.internal:7890' },
        probes: [{ url: 'http://host.docker.internal:7890', ok: true }]
      },
      {
        network: 'bridge',
        env: { HTTPS_PROXY: 'http://host.docker.internal:7890' }
      }
    );

    expect(next.decisionLabel).toBe('当前走代理');
    expect(next.effectiveProxy).toBe('http://host.docker.internal:7890');
    expect(next.sandboxUsesProxy).toBe(true);
    expect(next.sandboxProxy).toBe('http://host.docker.internal:7890');
  });
});

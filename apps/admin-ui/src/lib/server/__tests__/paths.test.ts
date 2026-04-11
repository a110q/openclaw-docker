import { describe, expect, it } from 'vitest';
import { resolveAdminPaths } from '../paths';

describe('resolveAdminPaths', () => {
  it('derives repo, host data, and metadata directories', () => {
    const paths = resolveAdminPaths({
      repoRoot: '/workspace/openclaw_docker',
      hostDataRoot: '/data/openclaw_host'
    });

    expect(paths.repoRoot).toBe('/workspace/openclaw_docker');
    expect(paths.hostDataRoot).toBe('/data/openclaw_host');
    expect(paths.adminDataDir).toBe('/data/openclaw_host/openclaw/admin-ui');
    expect(paths.managedAgentsFile).toBe('/data/openclaw_host/openclaw/admin-ui/managed-agents.json');
  });
});

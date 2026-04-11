import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  responses: new Map<string, { exitCode: number; stdout: string; stderr: string }>(),
}));

vi.mock('../config-files', () => ({
  readOpenClawConfig: vi.fn(async () => ({})),
  writeOpenClawConfig: vi.fn(async () => undefined),
}));

vi.mock('../compose', () => ({
  stripAnsi: vi.fn((value: string) => value),
  runCommand: vi.fn(async (args: string[]) => {
    const key = args.join(' ');
    const next = mockState.responses.get(key);
    if (!next) {
      throw new Error(`unexpected command: ${key}`);
    }
    return next;
  }),
}));

import {
  readSandboxContainerSnapshot,
  restartSandboxContainer,
  removeSandboxContainer,
} from '../sandbox-resources';

describe('sandbox runtime snapshot', () => {
  beforeEach(() => {
    mockState.responses = new Map<string, { exitCode: number; stdout: string; stderr: string }>();
  });

  it('builds sorted container summaries with agent linkage and resource limits', async () => {
    mockState.responses.set(
      'docker ps --all --filter label=openclaw.sandbox=1 --format {{.Names}}',
      {
        exitCode: 0,
        stdout: 'sandbox-b\nsandbox-a\n',
        stderr: '',
      },
    );
    mockState.responses.set(
      'docker inspect sandbox-b sandbox-a',
      {
        exitCode: 0,
        stdout: JSON.stringify([
          {
            Id: 'bbbbbbbbbbbb11112222333344445555',
            Name: '/sandbox-b',
            Created: '2026-04-11T02:00:00.000Z',
            State: { Status: 'exited' },
            Config: { Labels: { 'openclaw.sessionKey': 'agent:zeta' } },
            HostConfig: { Memory: 0, MemorySwap: 0, NanoCpus: 0, PidsLimit: 0, NetworkMode: 'bridge' },
          },
          {
            Id: 'aaaaaaaaaaaa11112222333344445555',
            Name: '/sandbox-a',
            Created: '2026-04-11T01:00:00.000Z',
            State: { Status: 'running' },
            Config: { Labels: { 'openclaw.sessionKey': 'agent:alpha' } },
            HostConfig: { Memory: 1073741824, MemorySwap: 2147483648, NanoCpus: 1500000000, PidsLimit: 512, NetworkMode: 'host' },
          },
        ]),
        stderr: '',
      },
    );
    mockState.responses.set(
      'docker stats --no-stream --format {{json .}} sandbox-b sandbox-a',
      {
        exitCode: 0,
        stdout: [
          JSON.stringify({ ID: 'bbbb', Name: 'sandbox-b', CPUPerc: '0.33%', MemUsage: '12.1MiB / 0B' }),
          JSON.stringify({ ID: 'aaaa', Name: 'sandbox-a', CPUPerc: '12.50%', MemUsage: '256MiB / 1GiB' }),
        ].join('\n'),
        stderr: '',
      },
    );

    const items = await readSandboxContainerSnapshot();

    expect(items.map((item) => item.name)).toEqual(['sandbox-a', 'sandbox-b']);
    expect(items[0]).toMatchObject({
      agentId: 'alpha',
      status: 'running',
      cpuUsage: '12.50%',
      memoryUsage: '256MiB',
      memoryLimit: '1GiB',
      cpuLimit: '1.5',
      pidsLimit: 512,
      networkMode: 'host',
    });
    expect(items[1]).toMatchObject({
      agentId: 'zeta',
      status: 'exited',
      cpuLimit: '未限制',
      memoryLimit: '未限制',
      networkMode: 'bridge',
    });
  });

  it('restarts and removes a specific sandbox container by name', async () => {
    mockState.responses.set('docker restart sandbox-a', {
      exitCode: 0,
      stdout: 'sandbox-a\n',
      stderr: '',
    });
    mockState.responses.set('docker rm -f sandbox-a', {
      exitCode: 0,
      stdout: 'sandbox-a\n',
      stderr: '',
    });

    await expect(restartSandboxContainer('sandbox-a')).resolves.toEqual({ ok: true, name: 'sandbox-a' });
    await expect(removeSandboxContainer('sandbox-a')).resolves.toEqual({ ok: true, name: 'sandbox-a' });
  });
});

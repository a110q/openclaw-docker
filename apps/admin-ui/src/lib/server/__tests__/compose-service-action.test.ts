import { describe, expect, it } from 'vitest';
import { resolveComposeServiceAction } from '../compose';

describe('resolveComposeServiceAction', () => {
  it('maps supported service actions to docker compose commands', () => {
    expect(resolveComposeServiceAction('openclaw-gateway', 'start')).toEqual([
      'docker',
      'compose',
      'up',
      '-d',
      'openclaw-gateway',
    ]);
    expect(resolveComposeServiceAction('openclaw-gateway', 'recreate')).toEqual([
      'docker',
      'compose',
      'up',
      '-d',
      '--force-recreate',
      'openclaw-gateway',
    ]);
    expect(resolveComposeServiceAction('openclaw-gateway', 'build-recreate')).toEqual([
      'docker',
      'compose',
      'up',
      '-d',
      '--build',
      '--force-recreate',
      'openclaw-gateway',
    ]);
  });

  it('rejects unsupported actions and unsafe service names', () => {
    expect(() => resolveComposeServiceAction('openclaw-gateway', 'rm -rf /')).toThrow(/Unsupported admin action/);
    expect(() => resolveComposeServiceAction('openclaw-gateway;rm', 'restart')).toThrow(/Unsafe compose service/);
  });
});

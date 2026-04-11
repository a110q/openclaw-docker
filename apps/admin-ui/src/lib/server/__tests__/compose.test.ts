import { describe, expect, it } from 'vitest';
import { resolveComposeAction } from '../compose';

describe('resolveComposeAction', () => {
  it('maps only whitelisted admin actions', () => {
    expect(resolveComposeAction('restart')).toEqual(['docker', 'compose', 'restart', 'openclaw-gateway']);
    expect(() => resolveComposeAction('rm -rf /')).toThrow(/Unsupported admin action/);
  });
});

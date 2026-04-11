import { describe, expect, it } from 'vitest';
import {
  getDefaultAgentStorageSettings,
  sanitizeAgentStorageRelativePath,
} from '../agent-storage';

describe('agent-storage', () => {
  it('returns defaults for empty values', () => {
    const defaults = getDefaultAgentStorageSettings();
    expect(sanitizeAgentStorageRelativePath('', defaults.workspaceRoot)).toBe(
      defaults.workspaceRoot,
    );
  });

  it('normalizes valid relative paths', () => {
    expect(
      sanitizeAgentStorageRelativePath('custom/agents/workspace/', 'fallback'),
    ).toBe('custom/agents/workspace');
  });

  it('rejects absolute or parent paths', () => {
    expect(() =>
      sanitizeAgentStorageRelativePath('/custom/agents/workspace', 'fallback'),
    ).toThrow();
    expect(() =>
      sanitizeAgentStorageRelativePath('../outside', 'fallback'),
    ).toThrow();
    expect(() =>
      sanitizeAgentStorageRelativePath('../../outside', 'fallback'),
    ).toThrow();
  });
});

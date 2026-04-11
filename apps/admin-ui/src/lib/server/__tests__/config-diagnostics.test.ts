import { describe, expect, it } from 'vitest';
import { analyzeOpenClawConfig, applyRecommendedConfigFixes } from '../config-diagnostics';

describe('analyzeOpenClawConfig', () => {
  it('flags unsupported binding peer kinds and suggests a safe fix for legacy p2p', () => {
    const diagnostics = analyzeOpenClawConfig({
      bindings: [
        {
          agentId: 'default',
          match: {
            channel: 'feishu',
            peer: {
              kind: 'p2p',
              id: 'ou_123'
            }
          }
        }
      ]
    });

    expect(diagnostics.summary).toBe('error');
    expect(diagnostics.issueCount).toBe(1);
    expect(diagnostics.autoFixableCount).toBe(1);
    expect(diagnostics.issues[0]).toMatchObject({
      path: 'bindings[0].match.peer.kind',
      currentValue: 'p2p',
      suggestedValue: 'dm',
      autoFixAvailable: true
    });
  });

  it('keeps valid binding kinds clean', () => {
    const diagnostics = analyzeOpenClawConfig({
      bindings: [
        { match: { peer: { kind: 'group', id: 'group_1' } } },
        { match: { peer: { kind: 'dm', id: 'ou_456' } } }
      ]
    });

    expect(diagnostics.summary).toBe('healthy');
    expect(diagnostics.issueCount).toBe(0);
    expect(diagnostics.autoFixableCount).toBe(0);
  });
});

describe('applyRecommendedConfigFixes', () => {
  it('rewrites legacy p2p binding kinds to dm', () => {
    const result = applyRecommendedConfigFixes({
      bindings: [
        {
          match: {
            channel: 'feishu',
            peer: {
              kind: 'p2p',
              id: 'ou_123'
            }
          }
        }
      ]
    });

    expect(result.fixedCount).toBe(1);
    expect((result.config as { bindings: Array<{ match: { peer: { kind: string } } }> }).bindings[0]?.match.peer.kind).toBe('dm');
  });
});

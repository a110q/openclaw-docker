import { describe, expect, it } from 'vitest';
import { canDeleteProvider } from '../ui/provider-guards';

describe('canDeleteProvider', () => {
  it('blocks built-in providers and allows custom providers', () => {
    expect(canDeleteProvider('default')).toBe(false);
    expect(canDeleteProvider('claude')).toBe(false);
    expect(canDeleteProvider('gemini')).toBe(false);
    expect(canDeleteProvider('ollama')).toBe(false);
    expect(canDeleteProvider('custom-gateway')).toBe(true);
  });
});

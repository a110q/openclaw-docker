import { describe, expect, it } from 'vitest';
import { analyzeChangeImpact } from '../change-impact';

describe('analyzeChangeImpact', () => {
  it('marks model api key edits as force-recreate and proxy edits as init-data-dir-force-recreate', () => {
    expect(analyzeChangeImpact([{ field: 'OPENAI_COMPATIBLE_API_KEY', source: 'env' }]).impact).toBe('force-recreate');
    expect(analyzeChangeImpact([{ field: 'HTTP_PROXY', source: 'env' }]).impact).toBe('init-data-dir-force-recreate');
  });
});

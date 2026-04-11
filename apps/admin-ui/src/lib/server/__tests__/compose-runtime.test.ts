import { describe, expect, it } from 'vitest';
import { parseComposeJson, stripAnsi } from '../compose';

describe('parseComposeJson', () => {
  it('parses newline-delimited docker compose ps json rows', () => {
    const rows = parseComposeJson([
      JSON.stringify({ Service: 'openclaw-gateway', State: 'running', Health: 'healthy' }),
      JSON.stringify({ Service: 'openclaw-admin-ui', State: 'running', Health: '' })
    ].join('\n'));

    expect(rows).toHaveLength(2);
    expect(rows[0]?.Service).toBe('openclaw-gateway');
    expect(rows[1]?.State).toBe('running');
  });

  it('strips ansi sequences from compose log output', () => {
    expect(stripAnsi('\u001b[90mhello\u001b[39m world')).toBe('hello world');
  });
});

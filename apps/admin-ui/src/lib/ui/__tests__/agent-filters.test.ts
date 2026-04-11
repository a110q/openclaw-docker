import { describe, expect, it } from 'vitest';
import type { ManagedAgent } from '@/lib/types/admin';
import { filterAgents } from '../agent-filters';

const agents: ManagedAgent[] = [
  {
    id: 'ops-001',
    name: 'ops-001',
    displayName: 'Ops Primary',
    source: 'manual',
    workspacePath: '/data/ops-001',
    agentDirPath: '/data/ops-001/.openclaw',
    runtimeStatus: 'running',
    primaryModelId: 'default/gpt-5.4',
    inheritsDefaultModel: false,
    sandboxMode: 'workspace-write',
    tags: ['ops'],
    notes: 'night shift',
    managed: true
  },
  {
    id: 'dev-001',
    name: 'dev-001',
    displayName: 'Dev Sandbox',
    source: 'discovered',
    workspacePath: '/data/dev-001',
    agentDirPath: '/data/dev-001/.openclaw',
    runtimeStatus: 'stopped',
    primaryModelId: 'claude/sonnet',
    inheritsDefaultModel: true,
    sandboxMode: 'read-only',
    tags: ['dev'],
    notes: 'frontend',
    managed: true
  }
];

describe('filterAgents', () => {
  it('filters by search text across id, display name, model and notes', () => {
    expect(filterAgents(agents, { search: 'night', runtimeStatus: 'all', source: 'all', selectedOnly: false }, [])).toHaveLength(1);
    expect(filterAgents(agents, { search: 'sonnet', runtimeStatus: 'all', source: 'all', selectedOnly: false }, [])[0]?.id).toBe('dev-001');
  });

  it('combines runtime/source filters and selected-only mode', () => {
    const filtered = filterAgents(
      agents,
      { search: '', runtimeStatus: 'running', source: 'manual', selectedOnly: true },
      ['ops-001']
    );

    expect(filtered.map((agent) => agent.id)).toEqual(['ops-001']);
  });
});

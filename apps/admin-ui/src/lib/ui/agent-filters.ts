import type { ManagedAgent, ManagedAgentSource, RuntimeStatus } from '@/lib/types/admin';

export type AgentFilterState = {
  search: string;
  runtimeStatus: RuntimeStatus | 'all';
  source: ManagedAgentSource | 'all';
  selectedOnly: boolean;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function filterAgents(agents: ManagedAgent[], filters: AgentFilterState, selectedIds: string[]) {
  const search = normalize(filters.search);
  const selectedSet = new Set(selectedIds);

  return agents.filter((agent) => {
    if (filters.runtimeStatus !== 'all' && agent.runtimeStatus !== filters.runtimeStatus) {
      return false;
    }

    if (filters.source !== 'all' && agent.source !== filters.source) {
      return false;
    }

    if (filters.selectedOnly && !selectedSet.has(agent.id)) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = [
      agent.id,
      agent.name,
      agent.displayName,
      agent.primaryModelId,
      agent.imageModelId,
      agent.notes,
      agent.sandboxMode,
      ...(agent.tags ?? [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(search);
  });
}

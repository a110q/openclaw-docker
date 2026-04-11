import type { ChangeImpact, TaskStatus } from './admin';

export type HostCapabilityId =
  | 'host.compose.ps'
  | 'host.compose.logs'
  | 'host.provider.upsert'
  | 'host.alert.feishu.upsert'
  | 'host.service.recreateGateway';

export type HostCapabilityRiskLevel = 'read' | 'write' | 'danger';

export interface HostCapabilityDefinition {
  id: HostCapabilityId;
  title: string;
  description: string;
  riskLevel: HostCapabilityRiskLevel;
  requiresConfirmation: boolean;
  targetType: 'compose' | 'provider' | 'alert-channel' | 'service';
}

export interface HostCapabilityPreview {
  id: string;
  capabilityId: HostCapabilityId;
  title: string;
  summary: string;
  impact: ChangeImpact;
  changes: Array<{ field: string; source: 'env' | 'openclaw-json' | 'admin-meta' }>;
  requiresConfirmation: boolean;
  riskLevel: HostCapabilityRiskLevel;
  dryRunData?: Record<string, unknown>;
}

export interface HostCapabilityExecution {
  taskId: string;
  capabilityId: HostCapabilityId;
  status: TaskStatus;
  summary: string;
  result: unknown;
  logs: string[];
}

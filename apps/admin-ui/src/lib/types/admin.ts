export type DeploymentMode = 'docker' | 'local';
export type RuntimeStatus = 'running' | 'stopped' | 'starting' | 'unhealthy' | 'unknown';
export type HealthStatus = 'healthy' | 'starting' | 'unhealthy' | 'unknown';
export type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed';
export type ChangeImpact = 'restart' | 'force-recreate' | 'build-force-recreate' | 'init-data-dir-force-recreate';
export type ProviderType = 'openai-compatible' | 'anthropic' | 'gemini' | 'ollama';
export type ManagedAgentSource = 'discovered' | 'manual' | 'batch-created';
export type DiscoveryStatus = 'already-managed' | 'discoverable' | 'invalid' | 'ignored';

export interface ProviderModelRecord {
  id: string;
  name: string;
  capabilities: string[];
}

export interface ProviderRecord {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKeyMasked: string;
  apiKeyConfigured: boolean;
  enabled: boolean;
  isDefault: boolean;
  modelCount: number;
  modelId?: string;
  modelName?: string;
  defaultModelId?: string;
  models: ProviderModelRecord[];
  websiteUrl?: string;
  notes?: string;
  lastTestStatus: 'unknown' | 'ok' | 'failed';
  lastTestAt?: string;
  lastError?: string;
}

export interface ModelCatalogItem {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capabilities: string[];
  contextWindow?: number;
  maxTokens?: number;
  enabled: boolean;
  isDefault: boolean;
}

export interface ManagedAgent {
  id: string;
  name: string;
  displayName: string;
  source: ManagedAgentSource;
  workspacePath: string;
  agentDirPath: string;
  runtimeStatus: RuntimeStatus;
  primaryModelId: string;
  imageModelId?: string;
  inheritsDefaultModel: boolean;
  sandboxMode: string;
  sandboxResourceSource?: 'default' | 'agent';
  sandboxCpuLimit?: number;
  sandboxMemoryLimit?: string;
  sandboxMemorySwap?: string;
  sandboxPidsLimit?: number;
  alertPolicyId?: string;
  tags: string[];
  notes?: string;
  lastSeenAt?: string;
  managed: boolean;
}

export interface SandboxContainerSummary {
  id: string;
  name: string;
  shortId: string;
  sessionKey?: string;
  agentId?: string;
  status: string;
  createdAt?: string;
  cpuUsage?: string;
  memoryUsage?: string;
  memoryLimit?: string;
  cpuLimit?: string;
  pidsLimit?: number;
  networkMode?: string;
}

export interface DiscoveryItem {
  path: string;
  suggestedName: string;
  status: DiscoveryStatus;
  reason: string;
  detectedModelId?: string;
  lastModifiedAt?: string;
}

export interface AlertChannel {
  id: string;
  type: 'feishu-webhook';
  name: string;
  enabled: boolean;
  webhookMasked: string;
  webhookUrl?: string;
  secretConfigured: boolean;
  secret?: string;
  minLevel: 'info' | 'warning' | 'critical';
  lastTestStatus: 'unknown' | 'ok' | 'failed';
  lastTestAt?: string;
  lastError?: string;
}

export interface AlertRule {
  id: string;
  eventType: string;
  enabled: boolean;
  level: 'info' | 'warning' | 'critical';
  channelIds: string[];
  cooldownSeconds: number;
}

export interface TaskRecord {
  id: string;
  type: string;
  status: TaskStatus;
  title: string;
  targetType?: string;
  targetId?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  progress?: number;
  summary?: string;
  error?: string;
  logs: string[];
}

export interface ActivityRecord {
  id: string;
  createdAt: string;
  action: string;
  targetType?: string;
  targetId?: string;
  status: TaskStatus | 'logged';
  summary?: string;
}

export interface ChangePreview {
  id: string;
  source: string;
  impact: ChangeImpact;
  changes: Array<{ field: string; source: 'env' | 'openclaw-json' | 'admin-meta' }>;
  requiresConfirmation: boolean;
  createdAt: string;
}

export interface NetworkPolicyStatus {
  mode: 'auto' | 'direct' | 'proxy_only' | 'unknown';
  modeLabel: string;
  decision: 'proxy' | 'direct' | 'proxy_only_failed' | 'unknown';
  decisionLabel: string;
  reason: string;
  rawReason: string;
  configuredProxy?: string;
  effectiveProxy?: string;
  probeError?: string;
  probeUrl?: string;
  lastCheckedAt?: string;
  sandboxNetwork: string;
  sandboxUsesProxy: boolean;
  sandboxProxy?: string;
  sandboxExtraHostCount: number;
}

export interface SystemStatus {
  deploymentMode: DeploymentMode;
  gateway: {
    status: RuntimeStatus;
    health: HealthStatus;
    containerName?: string;
    image?: string;
    startedAt?: string;
    ports: string[];
  };
  clawswarm: {
    status: RuntimeStatus;
    health: HealthStatus;
    containerName?: string;
    ports: string[];
  };
  adminUi: {
    status: RuntimeStatus;
    version: string;
  };
  summary: {
    defaultProvider?: string;
    defaultModel?: string;
    managedAgentCount: number;
    enabledAlertChannels: number;
    clawswarmEnabled: boolean;
  };
}

export interface ConfigDiagnosticIssue {
  id: string;
  scope: 'config' | 'bindings' | 'providers' | 'agents';
  severity: 'warning' | 'error';
  path: string;
  message: string;
  currentValue?: string;
  allowedValues?: string[];
  suggestedValue?: string;
  autoFixAvailable: boolean;
}

export interface ConfigDiagnostics {
  summary: 'healthy' | 'warning' | 'error';
  configPath: string;
  checkedAt: string;
  issueCount: number;
  autoFixableCount: number;
  issues: ConfigDiagnosticIssue[];
}

export interface ConfigAutoFixResult {
  fixedCount: number;
  fixedPaths: string[];
  backupFile?: string;
  restartRecommended: boolean;
  summary: string;
}

export interface FeishuRecentMessage {
  occurredAt: string;
  text: string;
}

export interface MigrationExportSummary {
  fileName: string;
  kind: 'agent-bundle' | 'platform-bundle' | 'unknown';
  sizeBytes: number;
  modifiedAt: string;
  downloadPath: string;
}

export interface FeishuDiscoveredChannel {
  id: string;
  kind: 'bot-account' | 'group-binding' | 'dm-binding';
  source: 'openclaw-config';
  status: 'managed' | 'warning';
  title: string;
  subtitle: string;
  metadata: string[];
  accountId?: string;
  agentId?: string;
  peerId?: string;
  bindingKind?: string;
  enabled?: boolean;
  requireMention?: boolean;
  active?: boolean;
  lastActivityAt?: string;
  recentMessages?: FeishuRecentMessage[];
}

export interface FeishuDiscoverySnapshot {
  scannedAt: string;
  managedAlertChannels: number;
  botAccounts: number;
  groupBindings: number;
  dmBindings: number;
  warnings: number;
  items: FeishuDiscoveredChannel[];
}

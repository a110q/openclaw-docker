import type { HostCapabilityDefinition, HostCapabilityId } from '@/lib/types/host-capabilities';

const HOST_CAPABILITIES: HostCapabilityDefinition[] = [
  {
    id: 'host.compose.ps',
    title: '读取 Compose 服务状态',
    description: '读取 Docker Compose 当前服务状态与健康信息。',
    riskLevel: 'read',
    requiresConfirmation: false,
    targetType: 'compose'
  },
  {
    id: 'host.compose.logs',
    title: '读取 Compose 服务日志',
    description: '读取指定服务的最近日志输出。',
    riskLevel: 'read',
    requiresConfirmation: false,
    targetType: 'compose'
  },
  {
    id: 'host.provider.upsert',
    title: '新增或更新 Provider',
    description: '写入 Provider 配置，并可更新默认模型。',
    riskLevel: 'write',
    requiresConfirmation: true,
    targetType: 'provider'
  },
  {
    id: 'host.alert.feishu.upsert',
    title: '新增或更新飞书通道',
    description: '写入飞书 Webhook 通道配置。',
    riskLevel: 'write',
    requiresConfirmation: true,
    targetType: 'alert-channel'
  },
  {
    id: 'host.service.recreateGateway',
    title: '重建 Gateway 服务',
    description: '执行 gateway 强制重建，可能短暂影响可用性。',
    riskLevel: 'danger',
    requiresConfirmation: true,
    targetType: 'service'
  }
];

export function listHostCapabilities() {
  return HOST_CAPABILITIES;
}

export function getHostCapability(id: HostCapabilityId) {
  return HOST_CAPABILITIES.find((item) => item.id === id);
}

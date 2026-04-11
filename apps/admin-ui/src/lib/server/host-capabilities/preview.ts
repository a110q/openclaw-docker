import { analyzeChangeImpact } from '@/lib/server/change-impact';
import type { HostCapabilityPreviewInput } from '@/lib/schemas/host-capabilities';
import type { HostCapabilityPreview } from '@/lib/types/host-capabilities';
import { getHostCapability } from './registry';

function makePreviewBase(capabilityId: HostCapabilityPreview['capabilityId']) {
  const capability = getHostCapability(capabilityId);
  if (!capability) {
    throw new Error(`Unsupported capability: ${capabilityId}`);
  }

  return capability;
}

export async function previewHostCapability(input: HostCapabilityPreviewInput): Promise<HostCapabilityPreview> {
  const capability = makePreviewBase(input.capabilityId);

  if (input.capabilityId === 'host.compose.ps') {
    return {
      id: crypto.randomUUID(),
      capabilityId: input.capabilityId,
      title: capability.title,
      summary: '读取 Docker Compose 当前服务状态，不会修改宿主机配置。',
      impact: 'restart',
      changes: [],
      requiresConfirmation: capability.requiresConfirmation,
      riskLevel: capability.riskLevel,
      dryRunData: { service: 'all' }
    };
  }

  if (input.capabilityId === 'host.compose.logs') {
    return {
      id: crypto.randomUUID(),
      capabilityId: input.capabilityId,
      title: capability.title,
      summary: `读取 ${input.input.service} 最近 ${input.input.tail} 行日志。`,
      impact: 'restart',
      changes: [],
      requiresConfirmation: capability.requiresConfirmation,
      riskLevel: capability.riskLevel,
      dryRunData: { ...input.input }
    };
  }

  if (input.capabilityId === 'host.provider.upsert') {
    const changes = [
      { field: 'models.providers', source: 'openclaw-json' as const },
      { field: 'OPENAI_COMPATIBLE_BASE_URL', source: 'env' as const }
    ];
    const analysis = analyzeChangeImpact(changes);
    return {
      id: crypto.randomUUID(),
      capabilityId: input.capabilityId,
      title: capability.title,
      summary: `将更新 Provider ${input.input.id}，并同步默认模型 / 访问地址。`,
      impact: analysis.impact,
      changes,
      requiresConfirmation: analysis.requiresConfirmation,
      riskLevel: capability.riskLevel,
      dryRunData: { providerId: input.input.id }
    };
  }

  if (input.capabilityId === 'host.alert.feishu.upsert') {
    const changes = [{ field: 'alerts.channels', source: 'admin-meta' as const }];
    const analysis = analyzeChangeImpact(changes);
    return {
      id: crypto.randomUUID(),
      capabilityId: input.capabilityId,
      title: capability.title,
      summary: `将写入飞书通道 ${input.input.id}，后续可用于告警路由。`,
      impact: analysis.impact,
      changes,
      requiresConfirmation: capability.requiresConfirmation,
      riskLevel: capability.riskLevel,
      dryRunData: { channelId: input.input.id }
    };
  }

  const changes = [{ field: 'openclaw-gateway', source: 'admin-meta' as const }];
  return {
    id: crypto.randomUUID(),
    capabilityId: input.capabilityId,
    title: capability.title,
    summary: '将对 openclaw-gateway 执行强制重建。',
    impact: 'force-recreate',
    changes,
    requiresConfirmation: capability.requiresConfirmation,
    riskLevel: capability.riskLevel,
    dryRunData: { action: 'recreate' }
  };
}

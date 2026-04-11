import { saveAlertChannel } from '@/lib/server/alerts';
import { logActivity } from '@/lib/server/activity';
import { inspectComposeServices, readComposeLogs, runComposeActionTask } from '@/lib/server/compose';
import { saveProvider } from '@/lib/server/providers';
import { appendTaskLog, createTask, getTask, updateTask } from '@/lib/server/tasks';
import type { HostCapabilityExecuteInput } from '@/lib/schemas/host-capabilities';
import type { HostCapabilityExecution, HostCapabilityId } from '@/lib/types/host-capabilities';
import { getHostCapability } from './registry';

function resolveTargetId(input: HostCapabilityExecuteInput) {
  switch (input.capabilityId) {
    case 'host.compose.ps':
      return 'docker-compose';
    case 'host.compose.logs':
      return input.input.service;
    case 'host.provider.upsert':
      return input.input.id;
    case 'host.alert.feishu.upsert':
      return input.input.id;
    case 'host.service.recreateGateway':
      return 'openclaw-gateway';
  }
}

function requiresConfirmation(capabilityId: HostCapabilityId) {
  return capabilityId === 'host.provider.upsert'
    || capabilityId === 'host.alert.feishu.upsert'
    || capabilityId === 'host.service.recreateGateway';
}

async function failTask(taskId: string, message: string) {
  await appendTaskLog(taskId, `error: ${message}`);
  return updateTask(taskId, {
    status: 'failed',
    finishedAt: new Date().toISOString(),
    progress: 100,
    error: message,
    summary: message
  });
}

export async function executeHostCapability(input: HostCapabilityExecuteInput): Promise<HostCapabilityExecution> {
  const capability = getHostCapability(input.capabilityId);
  if (!capability) {
    throw new Error(`Unsupported capability: ${input.capabilityId}`);
  }

  const task = await createTask({
    type: `host-capability:${input.capabilityId}`,
    title: capability.title,
    targetType: capability.targetType,
    targetId: resolveTargetId(input)
  });

  if (requiresConfirmation(input.capabilityId) && input.confirmed !== true) {
    const message = `Confirmation required for capability ${input.capabilityId}`;
    const failedTask = await failTask(task.id, message);
    await logActivity({
      action: 'host.capability.execute',
      targetType: capability.targetType,
      targetId: input.capabilityId,
      status: 'failed',
      summary: message
    });
    throw new Error(failedTask.error ?? message);
  }

  await updateTask(task.id, {
    status: 'running',
    startedAt: new Date().toISOString(),
    progress: 20,
    summary: `执行中：${capability.title}`
  });
  await appendTaskLog(task.id, `capability: ${input.capabilityId}`);

  try {
    let result: unknown;
    let summary = capability.title;
    let shouldFinalizeTask = true;

    switch (input.capabilityId) {
      case 'host.compose.ps': {
        result = await inspectComposeServices();
        summary = `已读取 ${(result as Array<unknown>).length} 个 Compose 服务状态`;
        break;
      }
      case 'host.compose.logs': {
        result = await readComposeLogs(input.input.service, input.input.tail);
        summary = `已读取 ${input.input.service} 最近 ${input.input.tail} 行日志`;
        break;
      }
      case 'host.provider.upsert': {
        result = await saveProvider(input.input);
        summary = `已保存 Provider ${input.input.id}`;
        break;
      }
      case 'host.alert.feishu.upsert': {
        result = await saveAlertChannel({ ...input.input, webhookUrl: input.input.webhookUrl });
        summary = `已保存飞书通道 ${input.input.id}`;
        break;
      }
      case 'host.service.recreateGateway': {
        await appendTaskLog(task.id, 'gateway action: recreate');
        await runComposeActionTask(task.id, 'recreate');
        const nextTask = await getTask(task.id);
        result = { action: 'recreate', service: 'openclaw-gateway' };
        summary = nextTask?.summary ?? '已触发 Gateway 强制重建';
        shouldFinalizeTask = false;
        break;
      }
    }

    const finalTask = shouldFinalizeTask
      ? await updateTask(task.id, {
          status: 'succeeded',
          finishedAt: new Date().toISOString(),
          progress: 100,
          summary
        })
      : ((await getTask(task.id)) ?? task);

    await logActivity({
      action: 'host.capability.execute',
      targetType: capability.targetType,
      targetId: input.capabilityId,
      status: 'succeeded',
      summary
    });

    return {
      taskId: finalTask.id,
      capabilityId: input.capabilityId,
      status: finalTask.status,
      summary: finalTask.summary ?? summary,
      result,
      logs: finalTask.logs
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    const currentTask = await getTask(task.id);

    if (currentTask?.status !== 'failed') {
      await failTask(task.id, message);
    }

    await logActivity({
      action: 'host.capability.execute',
      targetType: capability.targetType,
      targetId: input.capabilityId,
      status: 'failed',
      summary: message
    });
    throw error;
  }
}

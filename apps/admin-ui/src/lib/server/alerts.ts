import { readJsonFile, writeJsonFile } from './json-store';
import { getAdminPaths } from './paths';
import { logActivity } from './activity';
import type { AlertChannel, AlertRule } from '@/lib/types/admin';



type AlertChannelInput = Omit<AlertChannel, 'type' | 'webhookMasked' | 'secretConfigured' | 'lastTestStatus'> & { webhookUrl: string; secret?: string };

export function mergeAlertChannelDraft(existing: AlertChannel | undefined, input: AlertChannelInput): AlertChannel {
  const secret = input.secret || existing?.secret || '';

  return {
    id: input.id,
    type: 'feishu-webhook',
    name: input.name,
    enabled: input.enabled,
    webhookMasked: input.webhookUrl ? `${input.webhookUrl.slice(0, 24)}...` : '',
    webhookUrl: input.webhookUrl,
    secretConfigured: Boolean(secret),
    secret,
    minLevel: input.minLevel,
    lastTestStatus: existing?.lastTestStatus ?? 'unknown',
    lastTestAt: existing?.lastTestAt,
    lastError: existing?.lastError
  };
}

export async function listAlertChannels() {
  const { alertChannelsFile } = getAdminPaths();
  return readJsonFile<AlertChannel[]>(alertChannelsFile, []);
}

export async function saveAlertChannel(input: AlertChannelInput) {
  const { alertChannelsFile } = getAdminPaths();
  const channels = await listAlertChannels();
  const nextChannel = mergeAlertChannelDraft(channels.find((item) => item.id === input.id), input);
  const next = channels.some((item) => item.id === input.id)
    ? channels.map((item) => (item.id === input.id ? { ...item, ...nextChannel } : item))
    : [nextChannel, ...channels];
  await writeJsonFile(alertChannelsFile, next);
  await logActivity({ action: 'alert.channel.save', targetType: 'alert-channel', targetId: input.id, status: 'succeeded', summary: `保存飞书通道 ${input.id}` });
  return nextChannel;
}

export async function deleteAlertChannel(channelId: string) {
  const { alertChannelsFile } = getAdminPaths();
  const channels = await listAlertChannels();
  await writeJsonFile(alertChannelsFile, channels.filter((item) => item.id !== channelId));
  await logActivity({ action: 'alert.channel.delete', targetType: 'alert-channel', targetId: channelId, status: 'succeeded', summary: `删除飞书通道 ${channelId}` });
}

export async function testAlertChannel(channelId: string) {
  const channels = await listAlertChannels();
  const target = channels.find((item) => item.id === channelId);
  if (!target?.webhookUrl) throw new Error(`Alert channel not found: ${channelId}`);

  const response = await fetch(target.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg_type: 'text', content: { text: `OpenClaw Admin 测试消息：${target.name}` } }),
    signal: AbortSignal.timeout(5000)
  });

  const updated = channels.map((item) =>
    item.id === channelId
      ? {
          ...item,
          lastTestStatus: response.ok ? 'ok' : 'failed',
          lastTestAt: new Date().toISOString(),
          lastError: response.ok ? undefined : `HTTP ${response.status}`
        }
      : item
  );
  await writeJsonFile(getAdminPaths().alertChannelsFile, updated);
  await logActivity({
    action: 'alert.channel.test',
    targetType: 'alert-channel',
    targetId: channelId,
    status: response.ok ? 'succeeded' : 'failed',
    summary: response.ok ? `飞书通道 ${channelId} 测试成功` : `飞书通道 ${channelId} 测试失败，HTTP ${response.status}`
  });
  return { ok: response.ok, status: response.status };
}

export async function listAlertRules() {
  const { alertRulesFile } = getAdminPaths();
  return readJsonFile<AlertRule[]>(alertRulesFile, []);
}

export async function saveAlertRules(rules: AlertRule[]) {
  const { alertRulesFile } = getAdminPaths();
  await writeJsonFile(alertRulesFile, rules);
  await logActivity({ action: 'alert.rules.save', targetType: 'alert-rule', status: 'succeeded', summary: `保存 ${rules.length} 条告警规则` });
  return rules;
}

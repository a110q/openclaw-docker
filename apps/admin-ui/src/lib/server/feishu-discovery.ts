import { readOpenClawConfig } from './config-files';
import { listAlertChannels } from './alerts';
import { readComposeLogs } from './compose';
import type { AlertChannel, FeishuDiscoveredChannel, FeishuDiscoverySnapshot, FeishuRecentMessage } from '@/lib/types/admin';

type OpenClawLikeConfig = {
  channels?: {
    feishu?: {
      enabled?: boolean;
      connectionMode?: string;
      defaultAccount?: string;
      accounts?: Record<string, { appId?: string; name?: string }>;
      groups?: Record<string, { enabled?: boolean; requireMention?: boolean }>;
      allowFrom?: string[];
      dmAllowFrom?: string[];
    };
  };
  bindings?: Array<{
    agentId?: string;
    match?: {
      channel?: string;
      peer?: {
        kind?: string;
        id?: string;
      };
    };
  }>;
};

export interface FeishuActivityEntry {
  accountId: string;
  senderOpenId: string;
  chatId: string;
  chatType: string;
  occurredAt: string;
  messageText?: string;

}

const FEISHU_MESSAGE_PATTERN = /(\d{4}-\d{2}-\d{2}T[^\s]+).*?feishu\[(?<accountId>[^\]]+)\]: received message from (?<senderOpenId>\S+) in (?<chatId>\S+) \((?<chatType>[^)]+)\)/;
const FEISHU_CONTENT_PATTERN = /(\d{4}-\d{2}-\d{2}T[^\s]+).*?feishu\[(?<accountId>[^\]]+)\]: Feishu\[[^\]]+\] (?:(?:DM)|(?:Group.*?)) from (?<senderOpenId>\S+): (?<text>.+)$/;
const ACTIVITY_WINDOW_MS = 3 * 60 * 1000;
const MESSAGE_LINK_WINDOW_MS = 30 * 1000;

function maskAppId(appId?: string) {
  if (!appId) return '未配置 App ID';
  if (appId.length <= 10) return appId;
  return `${appId.slice(0, 6)}…${appId.slice(-4)}`;
}

function normalizeMessageText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function createDiscoveryItem(input: FeishuDiscoveredChannel): FeishuDiscoveredChannel {
  return input;
}

function emptySnapshot(scannedAt: string, managedAlertChannels: number): FeishuDiscoverySnapshot {
  return {
    scannedAt,
    managedAlertChannels,
    botAccounts: 0,
    groupBindings: 0,
    dmBindings: 0,
    warnings: 0,
    items: []
  };
}

function uniqueList(values: string[] = []) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function formatLastActivity(events: FeishuActivityEntry[], matcher: (event: FeishuActivityEntry) => boolean) {
  const latest = events
    .filter(matcher)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];
  return latest?.occurredAt;
}

function collectRecentMessages(events: FeishuActivityEntry[], matcher: (event: FeishuActivityEntry) => boolean): FeishuRecentMessage[] {
  return events
    .filter((event) => matcher(event) && event.messageText)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 4)
    .map((event) => ({ occurredAt: event.occurredAt, text: event.messageText! }));
}

function applyActivity(items: FeishuDiscoveredChannel[], activity: FeishuActivityEntry[]) {
  for (const item of items) {
    const matcher = (event: FeishuActivityEntry) => {
      if (item.kind === 'bot-account') {
        return event.accountId === item.accountId;
      }
      if (item.kind === 'group-binding') {
        return event.chatId === item.peerId;
      }
      return event.senderOpenId === item.peerId;
    };

    const lastActivityAt = formatLastActivity(activity, matcher);
    const recentMessages = collectRecentMessages(activity, matcher);

    item.active = Boolean(lastActivityAt);
    item.lastActivityAt = lastActivityAt;
    item.recentMessages = recentMessages;
  }
}

function toIsoWithinWindow(raw: string, now: Date, cutoff: number) {
  const timestamp = new Date(raw).getTime();
  if (Number.isNaN(timestamp) || timestamp < cutoff || timestamp > now.getTime()) {
    return undefined;
  }
  return new Date(timestamp).toISOString();
}

export function parseRecentFeishuActivity(logText: string, scannedAt = new Date().toISOString(), windowMs = ACTIVITY_WINDOW_MS): FeishuActivityEntry[] {
  const now = new Date(scannedAt);
  const cutoff = now.getTime() - windowMs;
  if (Number.isNaN(now.getTime())) {
    return [];
  }

  const events: FeishuActivityEntry[] = [];

  for (const line of logText.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const receivedMatch = line.match(FEISHU_MESSAGE_PATTERN);
    if (receivedMatch?.groups) {
      const occurredAt = toIsoWithinWindow(receivedMatch[1], now, cutoff);
      if (!occurredAt) {
        continue;
      }
      events.push({
        accountId: receivedMatch.groups.accountId,
        senderOpenId: receivedMatch.groups.senderOpenId,
        chatId: receivedMatch.groups.chatId,
        chatType: receivedMatch.groups.chatType,
        occurredAt
      });
      continue;
    }

    const contentMatch = line.match(FEISHU_CONTENT_PATTERN);
    if (!contentMatch?.groups) {
      continue;
    }

    const occurredAt = toIsoWithinWindow(contentMatch[1], now, cutoff);
    if (!occurredAt) {
      continue;
    }

    const senderOpenId = contentMatch.groups.senderOpenId;
    const accountId = contentMatch.groups.accountId;
    const messageText = normalizeMessageText(contentMatch.groups.text);

    const target = [...events].reverse().find((event) => {
      if (event.accountId !== accountId || event.senderOpenId !== senderOpenId) {
        return false;
      }
      if (event.messageText) {
        return false;
      }
      return Math.abs(new Date(event.occurredAt).getTime() - new Date(occurredAt).getTime()) <= MESSAGE_LINK_WINDOW_MS;
    });

    if (!target) {
      continue;
    }

    target.messageText = messageText;
  }

  return events;
}

export function summarizeFeishuDiscovery(
  config: OpenClawLikeConfig,
  alertChannels: AlertChannel[] = [],
  scannedAt = new Date().toISOString(),
  activity: FeishuActivityEntry[] = []
): FeishuDiscoverySnapshot {
  const managedAlertChannels = alertChannels.filter((item) => item.type === 'feishu-webhook').length;
  const feishu = config.channels?.feishu;
  if (!feishu) {
    return emptySnapshot(scannedAt, managedAlertChannels);
  }

  const snapshot: FeishuDiscoverySnapshot = emptySnapshot(scannedAt, managedAlertChannels);
  const defaultAccount = feishu.defaultAccount || 'default';
  const connectionMode = feishu.connectionMode || 'websocket';
  const accounts = Object.entries(feishu.accounts || {});
  const allowFrom = uniqueList(feishu.allowFrom || []);
  const dmAllowFrom = uniqueList(feishu.dmAllowFrom || []);

  for (const [accountId, account] of accounts) {
    const enabled = feishu.enabled !== false;
    const status: FeishuDiscoveredChannel['status'] = enabled && Boolean(account?.appId) ? 'managed' : 'warning';
    snapshot.botAccounts += 1;
    if (status === 'warning') snapshot.warnings += 1;
    snapshot.items.push(
      createDiscoveryItem({
        id: `account:${accountId}`,
        kind: 'bot-account',
        source: 'openclaw-config',
        status,
        title: account?.name || `飞书账号 ${accountId}`,
        subtitle: `账号 ${accountId} · ${maskAppId(account?.appId)}`,
        accountId,
        enabled,
        metadata: [
          accountId === defaultAccount ? '默认账号' : '附属账号',
          `连接 ${connectionMode}`,
          enabled ? '已启用' : '已停用'
        ]
      })
    );
  }

  for (const binding of config.bindings || []) {
    if (binding?.match?.channel !== 'feishu') continue;
    const rawKind = String(binding.match?.peer?.kind || '').trim().toLowerCase();
    const peerId = String(binding.match?.peer?.id || '').trim();
    const agentId = String(binding.agentId || '').trim() || '未绑定';
    if (!peerId) continue;

    if (rawKind === 'group') {
      snapshot.groupBindings += 1;
      const groupConfig = feishu.groups?.[peerId];
      const enabled = groupConfig?.enabled !== false;
      const requireMention = groupConfig?.requireMention !== false;
      const status: FeishuDiscoveredChannel['status'] = enabled ? 'managed' : 'warning';
      if (status === 'warning') snapshot.warnings += 1;
      snapshot.items.push(
        createDiscoveryItem({
          id: `group:${peerId}:${agentId}`,
          kind: 'group-binding',
          source: 'openclaw-config',
          status,
          title: `群通道 · ${agentId}`,
          subtitle: `群 ${peerId}`,
          agentId,
          peerId,
          bindingKind: rawKind,
          enabled,
          requireMention,
          metadata: [
            requireMention ? '需 @' : '免 @',
            enabled ? '群路由已启用' : '群路由已停用'
          ]
        })
      );
      continue;
    }

    if (['direct', 'dm', 'p2p'].includes(rawKind)) {
      snapshot.dmBindings += 1;
      const enabled = allowFrom.includes(peerId) || dmAllowFrom.includes(peerId);
      const status: FeishuDiscoveredChannel['status'] = rawKind === 'p2p' || !enabled ? 'warning' : 'managed';
      if (status === 'warning') snapshot.warnings += 1;
      snapshot.items.push(
        createDiscoveryItem({
          id: `dm:${peerId}:${agentId}`,
          kind: 'dm-binding',
          source: 'openclaw-config',
          status,
          title: `私聊通道 · ${agentId}`,
          subtitle: `用户 ${peerId}`,
          agentId,
          peerId,
          bindingKind: rawKind,
          enabled,
          metadata: [
            rawKind === 'p2p' ? '旧版 P2P 绑定' : '私聊路由',
            enabled ? '白名单已放行' : '白名单未放行',
            `账号 ${defaultAccount}`
          ]
        })
      );
    }
  }

  applyActivity(snapshot.items, activity);
  return snapshot;
}

export async function readFeishuDiscoverySnapshot(): Promise<FeishuDiscoverySnapshot> {
  const scannedAt = new Date().toISOString();
  const alertChannels = await listAlertChannels().catch(() => []);

  try {
    const [config, logs] = await Promise.all([
      readOpenClawConfig<OpenClawLikeConfig>(),
      readComposeLogs('openclaw-gateway', 400).catch(() => '')
    ]);
    const activity = parseRecentFeishuActivity(logs, scannedAt);
    return summarizeFeishuDiscovery(config, alertChannels, scannedAt, activity);
  } catch {
    return emptySnapshot(scannedAt, alertChannels.filter((item) => item.type === 'feishu-webhook').length);
  }
}

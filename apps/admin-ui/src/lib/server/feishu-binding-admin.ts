import { getAdminPaths } from './paths';
import { readOpenClawConfig, writeOpenClawConfig } from './config-files';
import { logActivity } from './activity';

export type OpenClawFeishuBindingConfig = {
  channels?: {
    feishu?: {
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
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

export type FeishuBindingUpsertInput =
  | {
      kind: 'group-binding';
      peerId: string;
      agentId: string;
      enabled?: boolean;
      requireMention?: boolean;
    }
  | {
      kind: 'dm-binding';
      peerId: string;
      agentId: string;
      enabled?: boolean;
      bindingKind?: 'direct' | 'dm';
    };

export type FeishuBindingDeleteInput = {
  kind: 'group-binding' | 'dm-binding';
  peerId: string;
};

type BindingEntry = NonNullable<OpenClawFeishuBindingConfig['bindings']>[number];

export interface FeishuBindingMutationResult {
  configPath: string;
  restartRecommended: boolean;
  summary: string;
}

function cloneConfig<T>(config: T): T {
  return JSON.parse(JSON.stringify(config ?? {})) as T;
}

function normalizePeerId(peerId: string) {
  return peerId.trim();
}

function normalizeAgentId(agentId: string) {
  return agentId.trim();
}

function normalizeDmBindingKind(bindingKind?: 'direct' | 'dm') {
  return bindingKind === 'dm' ? 'dm' : 'direct';
}

function ensureUniqueList(values: string[] = []) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function addUniqueValue(values: string[] = [], value: string) {
  return ensureUniqueList([...values, value]);
}

function removeValue(values: string[] = [], value: string) {
  const target = value.trim();
  return ensureUniqueList(values).filter((item) => item !== target);
}

function isGroupBinding(entry: BindingEntry | undefined, peerId: string) {
  return entry?.match?.channel === 'feishu' && entry?.match?.peer?.kind === 'group' && entry?.match?.peer?.id === peerId;
}

function isDmBinding(entry: BindingEntry | undefined, peerId: string) {
  const kind = String(entry?.match?.peer?.kind || '').trim().toLowerCase();
  return entry?.match?.channel === 'feishu' && ['direct', 'dm', 'p2p'].includes(kind) && entry?.match?.peer?.id === peerId;
}

export function upsertFeishuBindingInConfig(config: OpenClawFeishuBindingConfig, input: FeishuBindingUpsertInput) {
  const next = cloneConfig(config);
  const peerId = normalizePeerId(input.peerId);
  const agentId = normalizeAgentId(input.agentId);

  next.channels ??= {};
  next.channels.feishu ??= {};
  next.bindings ??= [];

  if (input.kind === 'group-binding') {
    next.channels.feishu.groups ??= {};
    next.channels.feishu.groups[peerId] = {
      enabled: input.enabled !== false,
      requireMention: input.requireMention !== false
    };

    const index = next.bindings.findIndex((entry) => isGroupBinding(entry, peerId));
    const base = index >= 0 ? next.bindings[index] : {};
    const binding = {
      ...base,
      agentId,
      match: {
        ...(base.match || {}),
        channel: 'feishu',
        peer: {
          ...(base.match?.peer || {}),
          kind: 'group',
          id: peerId
        }
      }
    };

    if (index >= 0) {
      next.bindings[index] = binding;
    } else {
      next.bindings.push(binding);
    }

    return next;
  }

  const bindingKind = normalizeDmBindingKind(input.bindingKind);
  next.channels.feishu.allowFrom = ensureUniqueList(next.channels.feishu.allowFrom || []);
  next.channels.feishu.dmAllowFrom = ensureUniqueList(next.channels.feishu.dmAllowFrom || []);

  if (input.enabled === false) {
    next.channels.feishu.allowFrom = removeValue(next.channels.feishu.allowFrom, peerId);
    next.channels.feishu.dmAllowFrom = removeValue(next.channels.feishu.dmAllowFrom, peerId);
  } else {
    next.channels.feishu.allowFrom = addUniqueValue(next.channels.feishu.allowFrom, peerId);
    next.channels.feishu.dmAllowFrom = addUniqueValue(next.channels.feishu.dmAllowFrom, peerId);
  }

  const index = next.bindings.findIndex((entry) => isDmBinding(entry, peerId));
  const base = index >= 0 ? next.bindings[index] : {};
  const binding = {
    ...base,
    agentId,
    match: {
      ...(base.match || {}),
      channel: 'feishu',
      peer: {
        ...(base.match?.peer || {}),
        kind: bindingKind,
        id: peerId
      }
    }
  };

  if (index >= 0) {
    next.bindings[index] = binding;
  } else {
    next.bindings.push(binding);
  }

  return next;
}

export function deleteFeishuBindingInConfig(config: OpenClawFeishuBindingConfig, input: FeishuBindingDeleteInput) {
  const next = cloneConfig(config);
  const peerId = normalizePeerId(input.peerId);

  next.channels ??= {};
  next.channels.feishu ??= {};
  next.bindings ??= [];

  if (input.kind === 'group-binding') {
    next.bindings = next.bindings.filter((entry) => !isGroupBinding(entry, peerId));
    if (next.channels.feishu.groups) {
      delete next.channels.feishu.groups[peerId];
    }
    return next;
  }

  next.bindings = next.bindings.filter((entry) => !isDmBinding(entry, peerId));
  next.channels.feishu.allowFrom = removeValue(next.channels.feishu.allowFrom || [], peerId);
  next.channels.feishu.dmAllowFrom = removeValue(next.channels.feishu.dmAllowFrom || [], peerId);
  return next;
}

export async function saveFeishuBinding(input: FeishuBindingUpsertInput): Promise<FeishuBindingMutationResult> {
  const config = await readOpenClawConfig<OpenClawFeishuBindingConfig>();
  const next = upsertFeishuBindingInConfig(config, input);
  await writeOpenClawConfig(next);

  await logActivity({
    action: 'feishu.binding.save',
    targetType: 'config',
    targetId: input.peerId,
    status: 'succeeded',
    summary: input.kind === 'group-binding'
      ? `保存飞书群绑定 ${input.peerId} → ${input.agentId}`
      : `保存飞书私聊绑定 ${input.peerId} → ${input.agentId}`
  });

  return {
    configPath: getAdminPaths().openclawConfigFile,
    restartRecommended: true,
    summary: input.kind === 'group-binding'
      ? `已写入群绑定 ${input.peerId}，如当前路由未刷新，建议重启 openclaw-gateway。`
      : `已写入私聊绑定 ${input.peerId}，如当前路由未刷新，建议重启 openclaw-gateway。`
  };
}

export async function removeFeishuBinding(input: FeishuBindingDeleteInput): Promise<FeishuBindingMutationResult> {
  const config = await readOpenClawConfig<OpenClawFeishuBindingConfig>();
  const next = deleteFeishuBindingInConfig(config, input);
  await writeOpenClawConfig(next);

  await logActivity({
    action: 'feishu.binding.delete',
    targetType: 'config',
    targetId: input.peerId,
    status: 'succeeded',
    summary: input.kind === 'group-binding' ? `删除飞书群绑定 ${input.peerId}` : `删除飞书私聊绑定 ${input.peerId}`
  });

  return {
    configPath: getAdminPaths().openclawConfigFile,
    restartRecommended: true,
    summary: input.kind === 'group-binding'
      ? `已删除群绑定 ${input.peerId}，如当前路由仍在内存中，建议重启 openclaw-gateway。`
      : `已删除私聊绑定 ${input.peerId}，如当前路由仍在内存中，建议重启 openclaw-gateway。`
  };
}

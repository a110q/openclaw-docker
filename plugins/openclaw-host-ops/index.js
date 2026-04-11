import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const OPENCLAW_CONFIG_PATH = path.join(process.env.HOME || '/home/node', '.openclaw', 'openclaw.json');
const HOST_DATA_ROOT = process.env.OPENCLAW_HOST_DATA_ROOT || '';

function textResult(text, details) {
  return { content: [{ type: 'text', text }], details };
}

function jsonResult(data, summary) {
  return textResult(`${summary}\n\n${JSON.stringify(data, null, 2)}`, data);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: process.env, ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 0, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

async function readConfig() {
  return JSON.parse(await fs.readFile(OPENCLAW_CONFIG_PATH, 'utf8'));
}

async function writeConfig(config) {
  await fs.writeFile(OPENCLAW_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function ensureObject(target, key) {
  if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
  return target[key];
}

function defaultWorkspaceTemplate(agentId) {
  return `\${OPENCLAW_HOST_DATA_ROOT}/openclaw/workspace/agents/${agentId}`;
}

function defaultAgentDirTemplate(agentId) {
  return `\${OPENCLAW_HOST_DATA_ROOT}/openclaw/agents/${agentId}/agent`;
}

function materializeHostPath(rawPath) {
  const value = String(rawPath || '').trim();
  if (!value) return '';
  const replaced = HOST_DATA_ROOT ? value.replaceAll('${OPENCLAW_HOST_DATA_ROOT}', HOST_DATA_ROOT) : value;
  return path.resolve(replaced);
}

async function ensureAgentDirs(agentId, overrides = {}) {
  const workspacePath = materializeHostPath(overrides.workspace || defaultWorkspaceTemplate(agentId));
  const agentDirPath = materializeHostPath(overrides.agentDir || defaultAgentDirTemplate(agentId));
  if (workspacePath) await fs.mkdir(workspacePath, { recursive: true });
  if (agentDirPath) await fs.mkdir(agentDirPath, { recursive: true });
}

async function seedAgentWorkspaceFiles(agentId, workspace) {
  if (agentId === 'default') return;
  const templateDir = materializeHostPath(defaultWorkspaceTemplate('default'));
  const targetDir = materializeHostPath(workspace || defaultWorkspaceTemplate(agentId));
  if (!templateDir || !targetDir) return;
  const files = ['AGENTS.md', 'TOOLS.md', 'BOOTSTRAP.md', 'SOUL.md', 'USER.md', 'IDENTITY.md', 'HEARTBEAT.md'];
  for (const name of files) {
    const source = path.join(templateDir, name);
    const dest = path.join(targetDir, name);
    try {
      await fs.access(dest);
      continue;
    } catch {}
    try {
      const content = await fs.readFile(source, 'utf8');
      await fs.writeFile(dest, content, 'utf8');
    } catch {}
  }
}

async function listComposeServices() {
  const result = await runCommand('docker', ['ps', '--format', '{{json .}}']);
  if (result.code !== 0) throw new Error(result.stderr || 'docker ps failed');
  return result.stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((item) => item.Names.includes('openclaw'))
    .map((item) => ({
      id: item.ID,
      name: item.Names,
      image: item.Image,
      status: item.Status,
      ports: item.Ports
    }));
}

async function resolveServiceContainer(service) {
  const result = await runCommand('docker', ['ps', '-a', '--filter', `label=com.docker.compose.service=${service}`, '--format', '{{.Names}}']);
  if (result.code !== 0) throw new Error(result.stderr || `unable to resolve service ${service}`);
  const name = result.stdout.split('\n').find(Boolean);
  if (!name) throw new Error(`service not found: ${service}`);
  return name.trim();
}

async function readServiceLogs(service, tail) {
  const name = await resolveServiceContainer(service);
  const result = await runCommand('docker', ['logs', '--tail', String(tail || 120), name]);
  if (result.code !== 0 && !result.stderr && !result.stdout) throw new Error(`unable to read logs for ${service}`);
  return { service, container: name, logs: result.stdout || result.stderr };
}

async function restartService(service) {
  const name = await resolveServiceContainer(service);
  const delayed = `sleep 1; docker restart ${name} >/tmp/${service}-restart.log 2>&1`;
  const result = await runCommand('sh', ['-lc', `${delayed} &`]);
  if (result.code !== 0) throw new Error(result.stderr || `unable to schedule restart for ${service}`);
  return { service, container: name, scheduled: true };
}


function unsafeDefaultModelReason(config, modelRef) {
  if (!modelRef || typeof modelRef !== 'string') return '';
  const [providerId, modelId] = modelRef.split('/', 2);
  const provider = config?.models?.providers?.[providerId];
  const normalizedModelId = String(modelId || '').trim().toLowerCase();
  if (providerId === 'default' && provider?.api === 'openai-completions' && normalizedModelId.startsWith('glm-')) {
    return 'default/glm-* 当前会导致 OpenClaw 工具调用不稳定，不能作为默认 Agent 模型。';
  }
  return '';
}

function assertSafeDefaultModelRef(config, modelRef) {
  const reason = unsafeDefaultModelReason(config, modelRef);
  if (reason) throw new Error(reason);
}

function sanitizeProviderModelDrafts(models) {
  const seen = new Set();
  const next = [];
  for (const item of Array.isArray(models) ? models : []) {
    const id = String(item?.id || '').trim();
    const name = String(item?.name || id).trim() || id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    next.push({ id, name });
  }
  return next;
}

function resolveProviderDefaultModelId(config, providerId) {
  const ref = config?.agents?.defaults?.model?.primary || '';
  const [defaultProviderId, defaultModelId] = String(ref).split('/', 2);
  return defaultProviderId === providerId ? defaultModelId : '';
}

function buildProviderModels(params, existingModels, apiType) {
  const explicitModels = sanitizeProviderModelDrafts(params.models);
  const existingDrafts = sanitizeProviderModelDrafts((existingModels || []).map((item) => ({
    id: item.id,
    name: item.name || item.id
  })));

  let drafts = explicitModels;
  if (!drafts.length) {
    const legacyModelId = String(params.modelId || '').trim();
    const legacyModelName = String(params.modelName || legacyModelId).trim() || legacyModelId;
    if (!legacyModelId) {
      drafts = existingDrafts;
    } else if (!existingDrafts.length) {
      drafts = [{ id: legacyModelId, name: legacyModelName }];
    } else {
      const foundIndex = existingDrafts.findIndex((item) => item.id === legacyModelId);
      if (foundIndex >= 0) {
        existingDrafts[foundIndex] = { id: legacyModelId, name: legacyModelName };
        drafts = existingDrafts;
      } else {
        drafts = [...existingDrafts, { id: legacyModelId, name: legacyModelName }];
      }
    }
  }

  const existingMap = new Map((existingModels || []).map((item) => [item.id, item]));
  return drafts.map((draft) => {
    const existing = existingMap.get(draft.id) || {};
    return {
      ...existing,
      id: draft.id,
      name: draft.name,
      reasoning: existing.reasoning ?? false,
      input: Array.isArray(existing.input) && existing.input.length
        ? existing.input
        : Array.isArray(params.input) && params.input.length
          ? params.input
          : apiType === 'openai-completions'
            ? ['text', 'image']
            : ['text', 'image'],
      contextWindow: Number(existing.contextWindow || params.contextWindow || 128000),
      maxTokens: Number(existing.maxTokens || params.maxTokens || 8192)
    };
  });
}

function listAgents(config) {
  return (config.agents?.list || []).map((agent) => ({
    id: agent.id,
    name: agent.name,
    default: Boolean(agent.default),
    workspace: agent.workspace,
    agentDir: agent.agentDir,
    model: typeof agent.model === 'string' ? agent.model : agent.model?.primary || null,
    imageModel: typeof agent.imageModel === 'string' ? agent.imageModel : agent.imageModel?.primary || null
  }));
}

async function handleServiceControl(params) {
  const action = params.action || 'list';
  if (action === 'list') return jsonResult(await listComposeServices(), '当前 OpenClaw 相关容器状态');
  if (action === 'logs') return jsonResult(await readServiceLogs(params.service || 'openclaw-gateway', params.tail || 120), '已读取服务日志');
  if (action === 'restart') return jsonResult(await restartService(params.service || 'openclaw-gateway'), '已安排服务重启');
  throw new Error(`unsupported action: ${action}`);
}

async function handleProviderAdmin(params) {
  const config = await readConfig();
  config.models = config.models || {};
  config.models.providers = config.models.providers || {};
  config.agents = config.agents || {};
  config.agents.defaults = config.agents.defaults || {};
  config.agents.defaults.model = config.agents.defaults.model || {};
  config.agents.defaults.imageModel = config.agents.defaults.imageModel || {};

  if ((params.action || 'list') === 'list') {
    return jsonResult(config.models.providers, '当前 provider 配置');
  }

  if (params.action === 'upsert') {
    if (!params.providerId || !params.baseUrl || !params.apiType) {
      throw new Error('providerId / baseUrl / apiType are required');
    }

    const existingProvider = config.models.providers[params.providerId] || {};
    const nextModels = buildProviderModels(params, existingProvider.models || [], params.apiType);
    if (!nextModels.length) {
      throw new Error('provider requires at least one model');
    }

    config.models.providers[params.providerId] = {
      ...existingProvider,
      baseUrl: params.baseUrl,
      apiKey: params.apiKey || existingProvider.apiKey || '',
      api: params.apiType,
      models: nextModels
    };

    if (params.setDefault === true) {
      const defaultModelId = String(params.defaultModelId || '').trim()
        || resolveProviderDefaultModelId(config, params.providerId)
        || nextModels[0].id;
      const key = `${params.providerId}/${defaultModelId}`;
      assertSafeDefaultModelRef(config, key);
      config.agents.defaults.model.primary = key;
      config.agents.defaults.imageModel.primary = key;
    }

    await writeConfig(config);
    return jsonResult({ provider: config.models.providers[params.providerId], restartRecommended: true }, `已保存 provider ${params.providerId}`);
  }

  if (params.action === 'bind-agent-model') {
    if (!params.agentId || !params.modelRef) throw new Error('agentId / modelRef are required');
    const list = config.agents.list || [];
    const found = list.find((item) => item.id === params.agentId);
    if (!found) throw new Error(`agent not found: ${params.agentId}`);
    if (found.id === 'default') assertSafeDefaultModelRef(config, params.modelRef);
    found.model = { primary: params.modelRef };
    if (params.imageModelRef) found.imageModel = { primary: params.imageModelRef };
    await writeConfig(config);
    return jsonResult({ agentId: found.id, model: found.model, imageModel: found.imageModel || null, restartRecommended: true }, `已绑定 agent ${found.id} 的模型`);
  }

  throw new Error(`unsupported action: ${params.action}`);
}

async function handleAgentAdmin(params) {
  const config = await readConfig();
  config.agents = config.agents || {};
  config.agents.list = config.agents.list || [];
  const action = params.action || 'list';

  if (action === 'list') return jsonResult(listAgents(config), '当前 agent 列表');

  if (action === 'create') {
    if (!params.agentId) throw new Error('agentId is required');
    if (config.agents.list.some((item) => item.id === params.agentId)) throw new Error(`agent already exists: ${params.agentId}`);
    const workspace = String(params.workspace || '').trim() || defaultWorkspaceTemplate(params.agentId);
    const agentDir = String(params.agentDir || '').trim() || defaultAgentDirTemplate(params.agentId);
    const next = {
      id: params.agentId,
      name: params.name || params.agentId,
      workspace,
      agentDir
    };
    if (params.modelRef) next.model = { primary: params.modelRef };
    if (params.default === true) next.default = true;
    config.agents.list.push(next);
    await ensureAgentDirs(params.agentId, { workspace, agentDir });
    await seedAgentWorkspaceFiles(params.agentId, workspace);
    await writeConfig(config);
    return jsonResult({ agentId: next.id, name: next.name, workspace: next.workspace, agentDir: next.agentDir, created: true }, `已创建 agent ${params.agentId}`);
  }

  if (action === 'set-identity' || action === 'update') {
    if (!params.agentId) throw new Error('agentId is required');
    const found = config.agents.list.find((item) => item.id === params.agentId);
    if (!found) throw new Error(`agent not found: ${params.agentId}`);
    if (typeof params.name === 'string' && params.name.trim()) {
      found.name = params.name.trim();
    }
    if (typeof params.workspace === 'string' && params.workspace.trim()) {
      found.workspace = params.workspace.trim();
    }
    if (typeof params.agentDir === 'string' && params.agentDir.trim()) {
      found.agentDir = params.agentDir.trim();
    }
    await ensureAgentDirs(found.id, { workspace: found.workspace, agentDir: found.agentDir });
    await seedAgentWorkspaceFiles(found.id, found.workspace);
    await writeConfig(config);
    return jsonResult({ agentId: found.id, name: found.name, workspace: found.workspace, agentDir: found.agentDir, updated: true }, `已更新 agent ${params.agentId}`);
  }

  if (action === 'delete') {
    if (!params.agentId) throw new Error('agentId is required');
    config.agents.list = config.agents.list.filter((item) => item.id !== params.agentId);
    if (Array.isArray(config.bindings)) {
      config.bindings = config.bindings.filter((item) => item.agentId !== params.agentId);
    }
    await writeConfig(config);
    return jsonResult({ agentId: params.agentId, deleted: true }, `已删除 agent ${params.agentId}`);
  }

  throw new Error(`unsupported action: ${action}`);
}

async function handleFeishuAdmin(params) {
  const config = await readConfig();
  config.channels = config.channels || {};
  config.channels.feishu = config.channels.feishu || {
    enabled: false,
    connectionMode: 'websocket',
    defaultAccount: 'default',
    dmPolicy: 'pairing',
    groupPolicy: 'allowlist',
    requireMention: true,
    groupAllowFrom: [],
    streaming: true,
    blockStreaming: true,
    typingIndicator: true,
    resolveSenderNames: true,
    accounts: {},
    groups: {}
  };
  config.bindings = Array.isArray(config.bindings) ? config.bindings : [];
  const action = params.action || 'get';

  if (action === 'get') {
    return jsonResult({ feishu: config.channels.feishu, bindings: config.bindings.filter((item) => item.match?.channel === 'feishu') }, '当前飞书配置');
  }

  if (action === 'setup-bot') {
    if (!params.appId || !params.appSecret) throw new Error('appId / appSecret are required');
    config.channels.feishu.enabled = params.enabled !== false;
    config.channels.feishu.defaultAccount = params.accountId || 'default';
    config.channels.feishu.accounts = config.channels.feishu.accounts || {};
    config.channels.feishu.accounts[config.channels.feishu.defaultAccount] = {
      ...(config.channels.feishu.accounts[config.channels.feishu.defaultAccount] || {}),
      appId: params.appId,
      appSecret: params.appSecret,
      name: params.accountName || 'OpenClaw Bot'
    };
    await writeConfig(config);
    return jsonResult({ accountId: config.channels.feishu.defaultAccount, enabled: config.channels.feishu.enabled, restartRecommended: true }, '已写入飞书机器人配置');
  }

  if (action === 'bind-group') {
    if (!params.groupId || !params.agentId) throw new Error('groupId / agentId are required');
    config.channels.feishu.groups = config.channels.feishu.groups || {};
    config.channels.feishu.groups[params.groupId] = {
      ...(config.channels.feishu.groups[params.groupId] || {}),
      enabled: params.enabled !== false,
      requireMention: params.requireMention !== false
    };
    const existingIndex = config.bindings.findIndex((item) => item.match?.channel === 'feishu' && item.match?.peer?.kind === 'group' && item.match?.peer?.id === params.groupId);
    const binding = {
      agentId: params.agentId,
      match: {
        channel: 'feishu',
        peer: {
          kind: 'group',
          id: params.groupId
        }
      }
    };
    if (existingIndex >= 0) config.bindings[existingIndex] = binding;
    else config.bindings.push(binding);
    await writeConfig(config);
    return jsonResult({ groupId: params.groupId, agentId: params.agentId, restartRecommended: true }, `已把飞书群 ${params.groupId} 绑定到 agent ${params.agentId}`);
  }

  throw new Error(`unsupported action: ${action}`);
}

const GenericActionSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    action: { type: 'string' }
  }
};

export default {
  id: 'host-ops',
  name: 'Host Ops',
  description: 'Gateway-side host operations for sandboxed agents.',
  register(api) {
    api.registerTool({
      name: 'host_service_control',
      label: 'Host Service Control',
      description: 'Operate gateway/admin containers from the host-capable gateway side. Actions: list, logs, restart.',
      parameters: {
        ...GenericActionSchema,
        properties: {
          ...GenericActionSchema.properties,
          service: { type: 'string', description: 'Compose service name, e.g. openclaw-gateway or openclaw-admin-ui' },
          tail: { type: 'number', description: 'How many recent log lines to read.' }
        }
      },
      async execute(_id, params) {
        try {
          return await handleServiceControl(params || {});
        } catch (error) {
          return textResult(`host_service_control failed: ${error instanceof Error ? error.message : String(error)}`, { error: true });
        }
      }
    }, { name: 'host_service_control' });

    api.registerTool({
      name: 'host_provider_admin',
      label: 'Host Provider Admin',
      description: 'Manage provider/model bindings in host OpenClaw config. Actions: list, upsert, bind-agent-model.',
      parameters: {
        ...GenericActionSchema,
        properties: {
          ...GenericActionSchema.properties,
          providerId: { type: 'string' },
          modelId: { type: 'string' },
          modelName: { type: 'string' },
          models: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } },
          defaultModelId: { type: 'string' },
          baseUrl: { type: 'string' },
          apiKey: { type: 'string' },
          apiType: { type: 'string', description: 'e.g. openai-completions / anthropic-messages / google-generative-ai' },
          setDefault: { type: 'boolean' },
          input: { type: 'array', items: { type: 'string' } },
          contextWindow: { type: 'number' },
          maxTokens: { type: 'number' },
          agentId: { type: 'string' },
          modelRef: { type: 'string', description: 'providerId/modelId' },
          imageModelRef: { type: 'string' }
        }
      },
      async execute(_id, params) {
        try {
          return await handleProviderAdmin(params || {});
        } catch (error) {
          return textResult(`host_provider_admin failed: ${error instanceof Error ? error.message : String(error)}`, { error: true });
        }
      }
    }, { name: 'host_provider_admin' });

    api.registerTool({
      name: 'host_agent_admin',
      label: 'Host Agent Admin',
      description: 'Manage host OpenClaw agents. Actions: list, create, delete.',
      parameters: {
        ...GenericActionSchema,
        properties: {
          ...GenericActionSchema.properties,
          agentId: { type: 'string' },
          name: { type: 'string' },
          modelRef: { type: 'string' },
          default: { type: 'boolean' }
        }
      },
      async execute(_id, params) {
        try {
          return await handleAgentAdmin(params || {});
        } catch (error) {
          return textResult(`host_agent_admin failed: ${error instanceof Error ? error.message : String(error)}`, { error: true });
        }
      }
    }, { name: 'host_agent_admin' });

    api.registerTool({
      name: 'host_feishu_admin',
      label: 'Host Feishu Admin',
      description: 'Configure the host-side Feishu bot and bind groups to agents. Actions: get, setup-bot, bind-group.',
      parameters: {
        ...GenericActionSchema,
        properties: {
          ...GenericActionSchema.properties,
          accountId: { type: 'string' },
          accountName: { type: 'string' },
          appId: { type: 'string' },
          appSecret: { type: 'string' },
          enabled: { type: 'boolean' },
          groupId: { type: 'string' },
          agentId: { type: 'string' },
          requireMention: { type: 'boolean' }
        }
      },
      async execute(_id, params) {
        try {
          return await handleFeishuAdmin(params || {});
        } catch (error) {
          return textResult(`host_feishu_admin failed: ${error instanceof Error ? error.message : String(error)}`, { error: true });
        }
      }
    }, { name: 'host_feishu_admin' });

    api.logger.info?.('[host-ops] registered tools: host_service_control, host_provider_admin, host_agent_admin, host_feishu_admin');
  }
};

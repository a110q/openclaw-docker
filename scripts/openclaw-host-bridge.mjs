#!/usr/bin/env node

const [, , ...argv] = process.argv;
const gatewayPort = process.env.OPENCLAW_GATEWAY_PORT || '18789';
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || '';
const gatewayBaseUrl = process.env.OPENCLAW_GATEWAY_BASE_URL || `http://127.0.0.1:${gatewayPort}`;
const sessionKey = process.env.OPENCLAW_SESSION_KEY || 'main';

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function usage() {
  process.stdout.write([
    'openclaw host bridge',
    '',
    'Usage:',
    '  openclaw gateway list',
    '  openclaw gateway logs [service] [--tail 30]',
    '  openclaw gateway restart [service]',
    '  openclaw provider list',
    '  openclaw provider upsert --provider-id ID --model-id ID --base-url URL --api-type TYPE [--api-key KEY]',
    '  openclaw provider bind-agent-model --agent-id ID --model-ref provider/model [--image-model-ref provider/model]',
    '  openclaw agent list [--json]',
    '  openclaw agent create --agent-id ID [--name NAME] [--workspace DIR] [--model-ref provider/model] [--default] [--json]',
    '  openclaw agent delete --agent-id ID [--json]',
    '  openclaw agents list [--json]',
    '  openclaw agents add ID [--workspace DIR] [--name NAME] [--non-interactive] [--json]',
    '  openclaw agents set-identity --agent ID --name NAME [--json]',
    '  openclaw feishu get',
    '  openclaw feishu setup-bot --app-id ID --app-secret SECRET [--account-id default] [--account-name NAME]',
    '  openclaw feishu bind-group --group-id ID --agent-id ID [--require-mention true|false]',
    ''
  ].join('\n'));
}

function coerceValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

function parseArgs(input) {
  const positionals = [];
  const options = {};
  for (let index = 0; index < input.length; index += 1) {
    const token = input[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = input[index + 1];
    if (!next || next.startsWith('--')) {
      options[key] = true;
      continue;
    }
    options[key] = coerceValue(next);
    index += 1;
  }
  return { positionals, options };
}

function pickOptions(options, mapping) {
  const output = {};
  for (const [from, to] of Object.entries(mapping)) {
    if (options[from] === undefined) continue;
    output[to] = options[from];
  }
  return output;
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function invokeTool(tool, args, options = {}) {
  const { jsonOnly = false } = options;
  if (!gatewayToken) fail('OPENCLAW_GATEWAY_TOKEN is empty; cannot call gateway bridge.');
  const response = await fetch(`${gatewayBaseUrl}/tools/invoke`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${gatewayToken}`
    },
    body: JSON.stringify({ sessionKey, tool, args })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    const message = payload?.error?.message || `gateway request failed (${response.status})`;
    fail(message, 2);
  }
  const result = payload.result || {};
  const details = result.details ?? result;
  if (jsonOnly) {
    printJson(details);
    return details;
  }
  const text = Array.isArray(result.content)
    ? result.content.filter((item) => item?.type === 'text' && typeof item.text === 'string').map((item) => item.text).join('\n\n')
    : '';
  if (text.trim()) {
    process.stdout.write(`${text.trim()}\n`);
    return details;
  }
  printJson(details);
  return details;
}

function resolveAgentId(positionals, options) {
  return positionals[0] || options['agent-id'] || options.agent;
}

async function handleLegacyAgent(action, positionals, options) {
  const jsonOnly = Boolean(options.json);
  if (action === 'list') return invokeTool('host_agent_admin', { action: 'list' }, { jsonOnly });
  if (action === 'create') {
    const agentId = resolveAgentId(positionals, options);
    return invokeTool('host_agent_admin', {
      action,
      agentId,
      ...pickOptions(options, {
        name: 'name',
        workspace: 'workspace',
        'agent-dir': 'agentDir',
        'model-ref': 'modelRef',
        default: 'default'
      })
    }, { jsonOnly });
  }
  if (action === 'delete') {
    const agentId = resolveAgentId(positionals, options);
    return invokeTool('host_agent_admin', { action, agentId }, { jsonOnly });
  }
  fail(`unsupported agent action: ${action}`);
}

async function handlePluralAgents(action, positionals, options) {
  const jsonOnly = Boolean(options.json);
  if (action === 'list') return invokeTool('host_agent_admin', { action: 'list' }, { jsonOnly });
  if (action === 'add') {
    const agentId = resolveAgentId(positionals, options);
    return invokeTool('host_agent_admin', {
      action: 'create',
      agentId,
      ...pickOptions(options, {
        name: 'name',
        workspace: 'workspace',
        'agent-dir': 'agentDir',
        'model-ref': 'modelRef',
        default: 'default'
      })
    }, { jsonOnly });
  }
  if (action === 'set-identity') {
    const agentId = resolveAgentId(positionals, options);
    return invokeTool('host_agent_admin', {
      action: 'set-identity',
      agentId,
      ...pickOptions(options, {
        name: 'name',
        workspace: 'workspace',
        'agent-dir': 'agentDir'
      })
    }, { jsonOnly });
  }
  if (action === 'remove' || action === 'delete') {
    const agentId = resolveAgentId(positionals, options);
    return invokeTool('host_agent_admin', { action: 'delete', agentId }, { jsonOnly });
  }
  fail(`unsupported agents action: ${action}`);
}

async function main() {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    usage();
    return;
  }

  const [domain, action = 'list', ...rest] = argv;
  const { positionals, options } = parseArgs(rest);

  if (domain === 'gateway') {
    const service = positionals[0] || options.service || 'openclaw-gateway';
    if (action === 'list') return invokeTool('host_service_control', { action: 'list' });
    if (action === 'logs') return invokeTool('host_service_control', { action: 'logs', service, tail: options.tail || 120 });
    if (action === 'restart') return invokeTool('host_service_control', { action: 'restart', service });
    fail(`unsupported gateway action: ${action}`);
  }

  if (domain === 'provider') {
    if (action === 'list') return invokeTool('host_provider_admin', { action: 'list' });
    if (action === 'upsert') {
      return invokeTool('host_provider_admin', {
        action: 'upsert',
        ...pickOptions(options, {
          'provider-id': 'providerId',
          'model-id': 'modelId',
          'model-name': 'modelName',
          'default-model-id': 'defaultModelId',
          'base-url': 'baseUrl',
          'api-key': 'apiKey',
          'api-type': 'apiType',
          'set-default': 'setDefault',
          input: 'input',
          'context-window': 'contextWindow',
          'max-tokens': 'maxTokens'
        })
      });
    }
    if (action === 'bind-agent-model') {
      return invokeTool('host_provider_admin', {
        action,
        ...pickOptions(options, {
          'agent-id': 'agentId',
          'model-ref': 'modelRef',
          'image-model-ref': 'imageModelRef'
        })
      });
    }
    fail(`unsupported provider action: ${action}`);
  }

  if (domain === 'agent') {
    return handleLegacyAgent(action, positionals, options);
  }

  if (domain === 'agents') {
    return handlePluralAgents(action, positionals, options);
  }

  if (domain === 'feishu') {
    if (action === 'get') return invokeTool('host_feishu_admin', { action: 'get' });
    if (action === 'setup-bot') {
      return invokeTool('host_feishu_admin', {
        action,
        ...pickOptions(options, {
          'account-id': 'accountId',
          'account-name': 'accountName',
          'app-id': 'appId',
          'app-secret': 'appSecret',
          enabled: 'enabled'
        })
      });
    }
    if (action === 'bind-group') {
      return invokeTool('host_feishu_admin', {
        action,
        ...pickOptions(options, {
          'group-id': 'groupId',
          'agent-id': 'agentId',
          'require-mention': 'requireMention'
        })
      });
    }
    fail(`unsupported feishu action: ${action}`);
  }

  fail(`unsupported command group: ${domain}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error), 2));

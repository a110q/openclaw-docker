import type { ChangePreview } from '../types/admin';

const ENV_FORCE_RECREATE = new Set([
  'OPENAI_COMPATIBLE_BASE_URL',
  'OPENAI_COMPATIBLE_API_KEY',
  'OPENCLAW_GATEWAY_TOKEN',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY'
]);
const ENV_INIT_SYNC = new Set([
  'OPENCLAW_HOST_DATA_ROOT',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'OPENCLAW_SANDBOX_NETWORK',
  'OPENCLAW_SANDBOX_EXTRA_HOST'
]);
const BUILD_TIME_FIELDS = new Set([
  'OPENCLAW_CONTROL_UI_DEFAULT_LOCALE',
  'OPENCLAW_CONTROL_UI_TEXT_MODE_DEFAULT',
  'OPENCLAW_CONTROL_UI_ENABLED_LOCALES',
  'OPENCLAW_CONTROL_UI_ENABLED_TEXT_MODES'
]);

export function analyzeChangeImpact(changes: Array<{ field: string; source: 'env' | 'openclaw-json' | 'admin-meta' }>): Pick<ChangePreview, 'impact' | 'requiresConfirmation'> {
  if (changes.some((change) => BUILD_TIME_FIELDS.has(change.field))) {
    return { impact: 'build-force-recreate', requiresConfirmation: true };
  }
  if (changes.some((change) => ENV_INIT_SYNC.has(change.field))) {
    return { impact: 'init-data-dir-force-recreate', requiresConfirmation: true };
  }
  if (changes.some((change) => change.source === 'openclaw-json' || ENV_FORCE_RECREATE.has(change.field))) {
    return { impact: 'force-recreate', requiresConfirmation: true };
  }
  return { impact: 'restart', requiresConfirmation: false };
}

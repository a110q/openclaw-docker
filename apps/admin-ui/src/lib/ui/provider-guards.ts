const PROTECTED_PROVIDER_IDS = new Set(['default', 'claude', 'gemini', 'ollama']);

export function canDeleteProvider(providerId: string) {
  return !PROTECTED_PROVIDER_IDS.has(providerId);
}

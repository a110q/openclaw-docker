import fs from 'fs/promises';
import { getAdminPaths } from './paths';

type EnvEntry = { type: 'entry'; key: string; value: string } | { type: 'raw'; raw: string };

function parseEnvLine(line: string): EnvEntry {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) {
    return { type: 'raw', raw: line };
  }
  return { type: 'entry', key: match[1], value: match[2] };
}

function serializeEnv(entries: EnvEntry[]) {
  return `${entries
    .map((entry) => (entry.type === 'entry' ? `${entry.key}=${entry.value}` : entry.raw))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')}\n`;
}

export async function readEnvFile() {
  const { envFile } = getAdminPaths();
  const text = await fs.readFile(envFile, 'utf8').catch(() => '');
  const entries = text.split(/\r?\n/).map(parseEnvLine);
  const values = Object.fromEntries(
    entries
      .filter((entry): entry is Extract<EnvEntry, { type: 'entry' }> => entry.type === 'entry')
      .map((entry) => [entry.key, entry.value])
  );

  return { entries, values };
}

export async function writeEnvValues(patch: Record<string, string>) {
  const { envFile } = getAdminPaths();
  const { entries } = await readEnvFile();
  const remaining = new Set(Object.keys(patch));
  const nextEntries = entries.map((entry) => {
    if (entry.type !== 'entry' || !(entry.key in patch)) {
      return entry;
    }

    remaining.delete(entry.key);
    return { type: 'entry' as const, key: entry.key, value: patch[entry.key] };
  });

  for (const key of remaining) {
    nextEntries.push({ type: 'entry', key, value: patch[key] });
  }

  await fs.writeFile(envFile, serializeEnv(nextEntries), 'utf8');
}

export async function readOpenClawConfig<T = Record<string, unknown>>() {
  const { openclawConfigFile } = getAdminPaths();
  const text = await fs.readFile(openclawConfigFile, 'utf8');
  return JSON.parse(text) as T;
}

export async function writeOpenClawConfig(config: unknown) {
  const { openclawConfigFile } = getAdminPaths();
  await fs.writeFile(openclawConfigFile, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function resolveEnvTemplate(value: string | undefined, env: Record<string, string>) {
  if (!value) return '';
  const match = value.match(/^\$\{([A-Z0-9_]+)\}$/);
  if (!match) return value;
  return env[match[1]] ?? '';
}

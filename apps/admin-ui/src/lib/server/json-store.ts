import fs from 'fs/promises';
import path from 'path';

async function ensureParent(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    if (!text.trim()) return fallback;
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  await ensureParent(filePath);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

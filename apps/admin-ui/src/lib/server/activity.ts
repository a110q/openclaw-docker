import { getAdminPaths } from './paths';
import { readJsonFile, writeJsonFile } from './json-store';
import type { ActivityRecord } from '../types/admin';

export async function listActivity(): Promise<ActivityRecord[]> {
  const { activityFile } = getAdminPaths();
  const entries = await readJsonFile<ActivityRecord[]>(activityFile, []);
  return entries.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function logActivity(input: Omit<ActivityRecord, 'id' | 'createdAt'>) {
  const { activityFile } = getAdminPaths();
  const entries = await readJsonFile<ActivityRecord[]>(activityFile, []);
  const next: ActivityRecord = {
    id: globalThis.crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...input
  };
  entries.unshift(next);
  await writeJsonFile(activityFile, entries);
  return next;
}

import { getAdminPaths } from './paths';
import { readJsonFile, writeJsonFile } from './json-store';
import type { TaskRecord } from '../types/admin';

export async function listTasks(): Promise<TaskRecord[]> {
  const { tasksFile } = getAdminPaths();
  const tasks = await readJsonFile<TaskRecord[]>(tasksFile, []);
  return tasks.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function getTask(taskId: string): Promise<TaskRecord | undefined> {
  const tasks = await listTasks();
  return tasks.find((task) => task.id === taskId);
}

export async function createTask(input: Pick<TaskRecord, 'type' | 'title' | 'targetType' | 'targetId'>): Promise<TaskRecord> {
  const { tasksFile } = getAdminPaths();
  const tasks = await readJsonFile<TaskRecord[]>(tasksFile, []);
  const task: TaskRecord = {
    id: globalThis.crypto.randomUUID(),
    type: input.type,
    title: input.title,
    targetType: input.targetType,
    targetId: input.targetId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    logs: []
  };
  tasks.unshift(task);
  await writeJsonFile(tasksFile, tasks);
  return task;
}

export async function updateTask(taskId: string, patch: Partial<TaskRecord>): Promise<TaskRecord> {
  const { tasksFile } = getAdminPaths();
  const tasks = await readJsonFile<TaskRecord[]>(tasksFile, []);
  const nextTasks = tasks.map((task) => task.id === taskId ? { ...task, ...patch } : task);
  const nextTask = nextTasks.find((task) => task.id === taskId);
  if (!nextTask) throw new Error(`Task not found: ${taskId}`);
  await writeJsonFile(tasksFile, nextTasks);
  return nextTask;
}

export async function appendTaskLog(taskId: string, message: string): Promise<TaskRecord> {
  const task = await getTask(taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return updateTask(taskId, {
    logs: [...task.logs, `[${new Date().toISOString()}] ${message}`]
  });
}

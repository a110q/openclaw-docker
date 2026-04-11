import { NextResponse } from 'next/server';
import { createTask, getTask } from '@/lib/server/tasks';
import { runPlatformClawSwarmSyncTask } from '@/lib/server/platform-clawswarm-sync';

export async function POST() {
  const task = await createTask({
    type: 'clawswarm_sync',
    title: 'ClawSwarm 手动同步',
    targetType: 'runtime',
    targetId: 'clawswarm',
  });

  await runPlatformClawSwarmSyncTask(task.id);
  const nextTask = await getTask(task.id);
  return NextResponse.json({ ok: true, data: nextTask ?? task });
}

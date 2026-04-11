import { NextResponse } from 'next/server';
import { createTask, getTask } from '@/lib/server/tasks';
import { runComposeActionTask } from '@/lib/server/compose';

export async function POST(_: Request, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  const task = await createTask({
    type: `gateway_${action}`,
    title: `Gateway ${action}`,
    targetType: 'service',
    targetId: 'openclaw-gateway'
  });

  await runComposeActionTask(task.id, action);
  const nextTask = await getTask(task.id);
  return NextResponse.json({ ok: true, data: nextTask ?? task });
}

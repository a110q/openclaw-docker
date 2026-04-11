import { NextResponse } from 'next/server';
import { getTask } from '@/lib/server/tasks';

export async function GET(_: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  const task = await getTask(taskId);
  return task ? NextResponse.json({ ok: true, data: task }) : NextResponse.json({ ok: false, error: 'Task not found' }, { status: 404 });
}

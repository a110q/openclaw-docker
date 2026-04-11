import { NextResponse } from 'next/server';
import { listTasks } from '@/lib/server/tasks';

export async function GET() {
  return NextResponse.json({ ok: true, data: await listTasks() });
}

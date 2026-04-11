import { NextResponse } from 'next/server';
import { readDiscoveryResults } from '@/lib/server/discovery';

export async function GET(_: Request, context: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await context.params;
  return NextResponse.json({ ok: true, data: await readDiscoveryResults(taskId) });
}

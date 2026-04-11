import { NextResponse } from 'next/server';
import { testAlertChannel } from '@/lib/server/alerts';

export async function POST(_: Request, context: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await context.params;
  const result = await testAlertChannel(channelId);
  return NextResponse.json({ ok: result.ok, data: result }, { status: result.ok ? 200 : 502 });
}

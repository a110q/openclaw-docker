import { NextRequest, NextResponse } from 'next/server';
import { alertChannelSchema } from '@/lib/schemas/admin';
import { deleteAlertChannel, listAlertChannels, saveAlertChannel } from '@/lib/server/alerts';

export async function GET(_: NextRequest, context: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await context.params;
  const channel = (await listAlertChannels()).find((item) => item.id === channelId);
  return channel ? NextResponse.json({ ok: true, data: channel }) : NextResponse.json({ ok: false, error: 'Channel not found' }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await context.params;
  const body = alertChannelSchema.parse({ ...(await request.json()), id: channelId });
  const channel = await saveAlertChannel({ ...body, webhookUrl: body.webhookUrl });
  return NextResponse.json({ ok: true, data: channel });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await context.params;
  await deleteAlertChannel(channelId);
  return NextResponse.json({ ok: true });
}

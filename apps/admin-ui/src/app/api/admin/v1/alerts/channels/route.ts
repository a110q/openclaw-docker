import { NextRequest, NextResponse } from 'next/server';
import { alertChannelSchema } from '@/lib/schemas/admin';
import { listAlertChannels, saveAlertChannel } from '@/lib/server/alerts';

export async function GET() {
  return NextResponse.json({ ok: true, data: await listAlertChannels() });
}

export async function POST(request: NextRequest) {
  const body = alertChannelSchema.parse(await request.json());
  const channel = await saveAlertChannel({ ...body, webhookUrl: body.webhookUrl });
  return NextResponse.json({ ok: true, data: channel });
}

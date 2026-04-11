import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { listAlertRules, saveAlertRules } from '@/lib/server/alerts';

const schema = z.array(z.object({
  id: z.string(),
  eventType: z.string(),
  enabled: z.boolean(),
  level: z.enum(['info', 'warning', 'critical']),
  channelIds: z.array(z.string()),
  cooldownSeconds: z.number()
}));

export async function GET() {
  return NextResponse.json({ ok: true, data: await listAlertRules() });
}

export async function PUT(request: NextRequest) {
  const rules = schema.parse(await request.json());
  return NextResponse.json({ ok: true, data: await saveAlertRules(rules) });
}

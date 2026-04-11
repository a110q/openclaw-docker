import { NextRequest, NextResponse } from 'next/server';
import { batchCreateSchema } from '@/lib/schemas/admin';
import { createAgentBatch } from '@/lib/server/agents';

export async function POST(request: NextRequest) {
  const body = batchCreateSchema.parse(await request.json());
  const created = await createAgentBatch(body);
  return NextResponse.json({ ok: true, data: created });
}

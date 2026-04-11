import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveAgentBindings } from '@/lib/server/agents';

const schema = z.object({
  agentIds: z.array(z.string()).min(1),
  primaryModelId: z.string().min(1),
  imageModelId: z.string().optional()
});

export async function POST(request: NextRequest) {
  const body = schema.parse(await request.json());
  const results = [];
  for (const agentId of body.agentIds) {
    results.push(await saveAgentBindings(agentId, { primaryModelId: body.primaryModelId, imageModelId: body.imageModelId }));
  }
  return NextResponse.json({ ok: true, data: results });
}

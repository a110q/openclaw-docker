import { NextRequest, NextResponse } from 'next/server';
import { agentBindingSchema } from '@/lib/schemas/admin';
import { saveAgentBindings } from '@/lib/server/agents';

export async function POST(request: NextRequest, context: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await context.params;
  const body = agentBindingSchema.parse(await request.json());
  const result = await saveAgentBindings(agentId, body);
  return NextResponse.json({ ok: true, data: result });
}

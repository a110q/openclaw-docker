import { NextRequest, NextResponse } from 'next/server';
import { agentCreateSchema } from '@/lib/schemas/admin';
import { listAgents, saveAgent } from '@/lib/server/agents';

export async function GET() {
  return NextResponse.json({ ok: true, data: await listAgents() });
}

export async function POST(request: NextRequest) {
  const body = agentCreateSchema.parse(await request.json());
  const agent = await saveAgent(body);
  return NextResponse.json({ ok: true, data: agent });
}

import { NextRequest, NextResponse } from 'next/server';
import { agentCreateSchema } from '@/lib/schemas/admin';
import { deleteAgent, listAgents, saveAgent } from '@/lib/server/agents';
import { deletePlatformLobstersByRuntimeAgentId } from '@/lib/server/platform-repo';

export async function GET(_: NextRequest, context: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await context.params;
  const agent = (await listAgents()).find((item) => item.id === agentId);
  return agent ? NextResponse.json({ ok: true, data: agent }) : NextResponse.json({ ok: false, error: 'Agent not found' }, { status: 404 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await context.params;
  const body = agentCreateSchema.parse({ ...(await request.json()), id: agentId });
  const agent = await saveAgent(body);
  return NextResponse.json({ ok: true, data: agent });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await context.params;
  await deleteAgent(agentId);
  await deletePlatformLobstersByRuntimeAgentId(agentId);
  return NextResponse.json({ ok: true });
}

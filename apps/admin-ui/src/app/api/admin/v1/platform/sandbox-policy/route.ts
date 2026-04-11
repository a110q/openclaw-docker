import { NextRequest, NextResponse } from 'next/server';
import { sandboxPolicySchema } from '@/lib/schemas/admin';
import { listAgents } from '@/lib/server/agents';
import {
  applySandboxResourcesToAgentContainers,
  readSandboxResourcePolicy,
  writeSandboxResourcePolicy,
} from '@/lib/server/sandbox-resources';

async function buildResponseData() {
  return {
    policy: await readSandboxResourcePolicy(),
  };
}

export async function GET() {
  return NextResponse.json({ ok: true, data: await buildResponseData() });
}

export async function POST(request: NextRequest) {
  try {
    const body = sandboxPolicySchema.parse(await request.json());
    const previousPolicy = await readSandboxResourcePolicy();
    const nextPolicy = await writeSandboxResourcePolicy(body as any);

    const agents = await listAgents();
    let appliedContainers = 0;
    for (const agent of agents) {
      if (agent.sandboxResourceSource === 'agent') continue;
      const result = await applySandboxResourcesToAgentContainers(agent.id, nextPolicy).catch(() => ({ updated: 0 }));
      appliedContainers += result.updated;
    }

    const clearedKeys = (['cpus', 'memory', 'memorySwap', 'pidsLimit'] as const).filter(
      (key) => previousPolicy[key] != null && nextPolicy[key] == null,
    );

    return NextResponse.json({
      ok: true,
      data: {
        ...(await buildResponseData()),
        appliedContainers,
        clearedKeys,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存默认沙箱资源策略失败';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

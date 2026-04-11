import { NextRequest, NextResponse } from 'next/server';
import { agentStorageSettingsSchema } from '@/lib/schemas/admin';
import {
  readAgentStorageSettings,
  resolveAgentStorageRoots,
  writeAgentStorageSettings,
} from '@/lib/server/agent-storage';

async function buildResponseData() {
  const [settings, resolved] = await Promise.all([
    readAgentStorageSettings(),
    resolveAgentStorageRoots(),
  ]);
  return {
    settings,
    resolved: {
      hostDataRoot: resolved.hostDataRoot,
      workspaceRootAbsolute: resolved.workspaceRootAbsolute,
      agentDirRootAbsolute: resolved.agentDirRootAbsolute,
    },
  };
}

export async function GET() {
  return NextResponse.json({ ok: true, data: await buildResponseData() });
}

export async function POST(request: NextRequest) {
  try {
    const body = agentStorageSettingsSchema.parse(await request.json());
    await writeAgentStorageSettings(body);
    return NextResponse.json({ ok: true, data: await buildResponseData() });
  } catch (error) {
    const message = error instanceof Error ? error.message : '保存 Agent 存储目录失败';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

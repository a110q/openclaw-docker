import { NextRequest, NextResponse } from 'next/server';
import { agentExportSchema } from '@/lib/schemas/admin';
import { exportAgentsBundle } from '@/lib/server/migration';

export async function POST(request: NextRequest) {
  try {
    const body = agentExportSchema.parse(await request.json());
    const result = await exportAgentsBundle(body.agentIds);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '导出 Agent 失败';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

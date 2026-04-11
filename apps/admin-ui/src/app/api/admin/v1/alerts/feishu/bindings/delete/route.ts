import { NextRequest, NextResponse } from 'next/server';
import { feishuBindingDeleteSchema } from '@/lib/schemas/admin';
import { removeFeishuBinding } from '@/lib/server/feishu-binding-admin';
import { readFeishuDiscoverySnapshot } from '@/lib/server/feishu-discovery';

export async function POST(request: NextRequest) {
  try {
    const body = feishuBindingDeleteSchema.parse(await request.json());
    const result = await removeFeishuBinding(body);
    const snapshot = await readFeishuDiscoverySnapshot();
    return NextResponse.json({ ok: true, data: snapshot, message: result.summary, restartRecommended: result.restartRecommended });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '删除飞书绑定失败' },
      { status: 500 }
    );
  }
}

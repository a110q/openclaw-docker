import { NextResponse } from 'next/server';
import { readFeishuDiscoverySnapshot } from '@/lib/server/feishu-discovery';

export async function POST() {
  try {
    const snapshot = await readFeishuDiscoverySnapshot();
    return NextResponse.json({ ok: true, data: snapshot });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '扫描飞书通道失败' },
      { status: 500 }
    );
  }
}

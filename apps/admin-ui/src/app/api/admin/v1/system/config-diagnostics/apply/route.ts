import { NextResponse } from 'next/server';
import { applyRecommendedOpenClawConfigFixes } from '@/lib/server/config-diagnostics';

export async function POST() {
  try {
    const result = await applyRecommendedOpenClawConfigFixes();
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '应用推荐修复失败' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { exportPlatformBundle, listMigrationExportSummaries } from '@/lib/server/migration';

export async function GET() {
  return NextResponse.json({ ok: true, data: await listMigrationExportSummaries() });
}

export async function POST() {
  try {
    const result = await exportPlatformBundle();
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成平台迁移包失败';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

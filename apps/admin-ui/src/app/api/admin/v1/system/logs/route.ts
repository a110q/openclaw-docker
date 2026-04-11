import { NextRequest, NextResponse } from 'next/server';
import { readComposeLogs } from '@/lib/server/compose';

export async function GET(request: NextRequest) {
  const service = request.nextUrl.searchParams.get('service') || 'openclaw-gateway';
  const tail = Number(request.nextUrl.searchParams.get('tail') || '120');
  const logs = await readComposeLogs(service, Number.isFinite(tail) ? tail : 120);
  return NextResponse.json({ ok: true, data: { service, logs } });
}

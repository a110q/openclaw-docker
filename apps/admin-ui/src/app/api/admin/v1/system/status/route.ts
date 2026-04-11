import { NextResponse } from 'next/server';
import { readSystemStatus } from '@/lib/server/system-status';

export async function GET() {
  const status = await readSystemStatus();
  return NextResponse.json({ ok: true, data: status });
}

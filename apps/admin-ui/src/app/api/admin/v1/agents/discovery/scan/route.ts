import { NextResponse } from 'next/server';
import { scanForAgents } from '@/lib/server/discovery';

export async function POST() {
  const result = await scanForAgents();
  return NextResponse.json({ ok: true, data: result });
}

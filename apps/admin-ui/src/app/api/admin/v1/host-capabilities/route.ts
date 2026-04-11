import { NextResponse } from 'next/server';
import { listHostCapabilities } from '@/lib/server/host-capabilities/registry';

export async function GET() {
  return NextResponse.json({ ok: true, data: listHostCapabilities() });
}

import { NextResponse } from 'next/server';
import { readSandboxContainerSnapshot } from '@/lib/server/sandbox-resources';

export async function GET() {
  const containers = await readSandboxContainerSnapshot();
  return NextResponse.json({ ok: true, data: containers });
}

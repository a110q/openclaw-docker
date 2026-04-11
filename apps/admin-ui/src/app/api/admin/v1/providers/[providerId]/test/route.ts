import { NextResponse } from 'next/server';
import { testProviderConnectivity } from '@/lib/server/providers';

export async function POST(_: Request, context: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await context.params;
  const result = await testProviderConnectivity(providerId);
  return NextResponse.json({ ok: result.ok, data: result }, { status: result.ok ? 200 : 502 });
}

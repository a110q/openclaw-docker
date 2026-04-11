import { NextRequest, NextResponse } from 'next/server';
import { providerInputSchema } from '@/lib/schemas/admin';
import { listProviders, saveProvider } from '@/lib/server/providers';

export async function GET() {
  const providers = await listProviders();
  return NextResponse.json({ ok: true, data: providers });
}

export async function POST(request: NextRequest) {
  const body = providerInputSchema.parse(await request.json());
  const provider = await saveProvider(body);
  return NextResponse.json({ ok: true, data: provider });
}

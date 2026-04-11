import { NextRequest, NextResponse } from 'next/server';
import { providerInputSchema } from '@/lib/schemas/admin';
import { deleteProvider, listProviders, saveProvider } from '@/lib/server/providers';

export async function GET(_: NextRequest, context: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await context.params;
  const providers = await listProviders();
  const provider = providers.find((item) => item.id === providerId);
  if (!provider) {
    return NextResponse.json({ ok: false, error: 'Provider not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: provider });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await context.params;
  const body = providerInputSchema.parse({ ...(await request.json()), id: providerId });
  const provider = await saveProvider(body);
  return NextResponse.json({ ok: true, data: provider });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await context.params;
  await deleteProvider(providerId);
  return NextResponse.json({ ok: true });
}

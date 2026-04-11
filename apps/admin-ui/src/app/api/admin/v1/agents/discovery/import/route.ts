import { NextRequest, NextResponse } from 'next/server';
import { discoveryImportSchema } from '@/lib/schemas/admin';
import { importDiscoveryItems } from '@/lib/server/discovery';

export async function POST(request: NextRequest) {
  const body = discoveryImportSchema.parse(await request.json());
  const created = await importDiscoveryItems(body.items);
  return NextResponse.json({ ok: true, data: created });
}

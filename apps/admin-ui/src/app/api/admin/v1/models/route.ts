import { NextResponse } from 'next/server';
import { listModels } from '@/lib/server/providers';

export async function GET() {
  const models = await listModels();
  return NextResponse.json({ ok: true, data: models });
}

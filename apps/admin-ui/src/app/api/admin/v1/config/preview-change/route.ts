import { NextRequest, NextResponse } from 'next/server';
import { analyzeChangeImpact } from '@/lib/server/change-impact';
import { previewChangeSchema } from '@/lib/schemas/admin';

export async function POST(request: NextRequest) {
  const body = previewChangeSchema.parse(await request.json());
  const analysis = analyzeChangeImpact(body.changes);
  return NextResponse.json({
    ok: true,
    data: {
      id: crypto.randomUUID(),
      source: body.source,
      changes: body.changes,
      createdAt: new Date().toISOString(),
      ...analysis
    }
  });
}

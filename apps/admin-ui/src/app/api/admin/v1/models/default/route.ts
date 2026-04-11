import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { saveDefaultModel } from '@/lib/server/providers';

const schema = z.object({ modelId: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    const { modelId } = schema.parse(await request.json());
    await saveDefaultModel(modelId);
    return NextResponse.json({ ok: true, data: { modelId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '切换失败';
    const status = error instanceof z.ZodError ? 400 : 422;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

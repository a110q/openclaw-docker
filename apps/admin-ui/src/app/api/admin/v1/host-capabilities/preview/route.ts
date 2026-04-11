import { NextResponse } from 'next/server';
import { hostCapabilityPreviewSchema } from '@/lib/schemas/host-capabilities';
import { previewHostCapability } from '@/lib/server/host-capabilities/preview';

export async function POST(request: Request) {
  const parsed = hostCapabilityPreviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid host capability preview payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = await previewHostCapability(parsed.data);
  return NextResponse.json({ ok: true, data });
}

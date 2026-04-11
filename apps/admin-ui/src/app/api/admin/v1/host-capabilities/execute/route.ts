import { NextResponse } from 'next/server';
import { hostCapabilityExecuteSchema } from '@/lib/schemas/host-capabilities';
import { executeHostCapability } from '@/lib/server/host-capabilities/execute';

export async function POST(request: Request) {
  const parsed = hostCapabilityExecuteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'Invalid host capability execute payload', issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = await executeHostCapability(parsed.data);
  return NextResponse.json({ ok: true, data });
}

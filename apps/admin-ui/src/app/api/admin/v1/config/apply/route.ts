import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { writeEnvValues, writeOpenClawConfig } from '@/lib/server/config-files';

const schema = z.object({
  envPatch: z.record(z.string()).default({}),
  openclawConfig: z.any().optional()
});

export async function POST(request: NextRequest) {
  const body = schema.parse(await request.json());

  if (Object.keys(body.envPatch).length) {
    await writeEnvValues(body.envPatch);
  }
  if (body.openclawConfig) {
    await writeOpenClawConfig(body.openclawConfig);
  }

  return NextResponse.json({ ok: true });
}

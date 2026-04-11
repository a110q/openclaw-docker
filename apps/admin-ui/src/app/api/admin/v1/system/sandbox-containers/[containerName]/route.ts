import { NextRequest, NextResponse } from 'next/server';
import { sandboxContainerActionSchema } from '@/lib/schemas/admin';
import { removeSandboxContainer, restartSandboxContainer } from '@/lib/server/sandbox-resources';

export async function POST(request: NextRequest, context: { params: Promise<{ containerName: string }> }) {
  const { containerName } = await context.params;
  const body = await request.json().catch(() => ({}));
  const { action } = sandboxContainerActionSchema.parse(body);

  if (action === 'restart') {
    const result = await restartSandboxContainer(containerName);
    return NextResponse.json({ ok: true, data: result });
  }

  const result = await removeSandboxContainer(containerName);
  return NextResponse.json({ ok: true, data: result });
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ containerName: string }> }) {
  const { containerName } = await context.params;
  const result = await removeSandboxContainer(containerName);
  return NextResponse.json({ ok: true, data: result });
}

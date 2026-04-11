import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { importAgentsBundle } from '@/lib/server/migration';
import { getAdminPaths } from '@/lib/server/paths';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const paths = getAdminPaths();
  const uploadDir = path.join(paths.migrationTempDir, 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });

  let uploadPath = '';
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: '请上传 Agent 导入包' }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
    uploadPath = path.join(uploadDir, `${Date.now()}-${safeName || 'agent-bundle.tar.gz'}`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(uploadPath, buffer);

    const result = await importAgentsBundle(uploadPath);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '导入 Agent 失败';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  } finally {
    if (uploadPath) {
      await fs.rm(uploadPath, { force: true }).catch(() => undefined);
    }
  }
}

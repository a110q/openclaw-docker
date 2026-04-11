import fs from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { NextRequest, NextResponse } from 'next/server';
import { resolveMigrationExportFile } from '@/lib/server/migration';

export const runtime = 'nodejs';

function buildContentType(fileName: string) {
  return fileName.endsWith('.tar.gz') ? 'application/gzip' : 'application/octet-stream';
}

export async function GET(_: NextRequest, context: { params: Promise<{ fileName: string }> }) {
  try {
    const { fileName } = await context.params;
    const filePath = resolveMigrationExportFile(fileName);
    const fileStat = await stat(filePath);
    const stream = fs.createReadStream(filePath);

    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'content-type': buildContentType(path.basename(filePath)),
        'content-length': String(fileStat.size),
        'content-disposition': `attachment; filename="${path.basename(filePath)}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '下载失败';
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}

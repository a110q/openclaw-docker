import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/schemas/admin';
import { createAdminSessionCookie, createAdminSessionValue, verifyAdminToken } from '@/lib/server/auth';
import { getAdminEnv } from '@/lib/server/env';

async function readToken(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = await request.json();
    return loginSchema.parse(body).token;
  }

  const formData = await request.formData();
  return loginSchema.parse({ token: formData.get('token') }).token;
}

export async function POST(request: NextRequest) {
  const token = await readToken(request);
  const expected = getAdminEnv().OPENCLAW_ADMIN_UI_TOKEN;
  const accepted = await verifyAdminToken(token, expected);

  if (!accepted) {
    return NextResponse.json({ ok: false, error: '无效的后台令牌' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.headers.append('Set-Cookie', createAdminSessionCookie(createAdminSessionValue(token)));
  return response;
}

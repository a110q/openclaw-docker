import { NextRequest, NextResponse } from 'next/server';
import { PLATFORM_SESSION_COOKIE_NAME } from '@/lib/platform-auth-constants';
import { getPlatformSession } from '@/lib/server/platform-repo';
import { readPlatformClawSwarmRuntimeSnapshot } from '@/lib/server/platform-clawswarm-runtime';

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(PLATFORM_SESSION_COOKIE_NAME)?.value ?? '';
  const session = await getPlatformSession(sessionId);
  if (!session) {
    return NextResponse.json({ ok: false, error: '请先登录平台账号' }, { status: 401 });
  }

  const runtime = await readPlatformClawSwarmRuntimeSnapshot();
  return NextResponse.json({ ok: true, data: runtime });
}

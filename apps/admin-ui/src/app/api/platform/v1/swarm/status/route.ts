import { NextRequest, NextResponse } from 'next/server';
import { PLATFORM_SESSION_COOKIE_NAME } from '@/lib/platform-auth-constants';
import { getPlatformSession } from '@/lib/server/platform-repo';
import { readPlatformSwarmOverview } from '@/lib/server/platform-clawswarm';

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(PLATFORM_SESSION_COOKIE_NAME)?.value ?? '';
  const session = await getPlatformSession(sessionId);
  if (!session) {
    return NextResponse.json({ ok: false, error: '请先登录平台账号' }, { status: 401 });
  }

  const overview = await readPlatformSwarmOverview(session.user.id);
  return NextResponse.json({
    ok: true,
    data: {
      service: overview.service,
      workspace: overview.workspace,
      counts: overview.counts,
      settings: overview.settings,
    },
  });
}

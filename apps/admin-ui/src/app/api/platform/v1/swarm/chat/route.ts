import { NextRequest, NextResponse } from 'next/server';
import { PLATFORM_SESSION_COOKIE_NAME } from '@/lib/platform-auth-constants';
import { getPlatformSession } from '@/lib/server/platform-repo';
import {
  readPlatformClawSwarmConversationForLobster,
  readPlatformClawSwarmChatWorkspace,
  sendPlatformClawSwarmConversationMessage,
} from '@/lib/server/platform-clawswarm-chat';

function resolveStatusCode(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('不存在')) return 404;
  if (message.includes('尚未同步')) return 409;
  if (message.includes('不能为空') || message.includes('缺少')) return 400;
  return 500;
}

async function requireSession(request: NextRequest) {
  const sessionId = request.cookies.get(PLATFORM_SESSION_COOKIE_NAME)?.value ?? '';
  return getPlatformSession(sessionId);
}

export async function GET(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: '请先登录平台账号' }, { status: 401 });
  }

  const lobsterId = request.nextUrl.searchParams.get('lobsterId')?.trim() ?? '';

  try {
    if (!lobsterId) {
      const workspace = await readPlatformClawSwarmChatWorkspace(session.user.id);
      return NextResponse.json({ ok: true, workspace });
    }

    const result = await readPlatformClawSwarmConversationForLobster(session.user.id, lobsterId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '读取协作会话失败' },
      { status: resolveStatusCode(error) },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await requireSession(request);
  if (!session) {
    return NextResponse.json({ ok: false, error: '请先登录平台账号' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    lobsterId?: string;
    content?: string;
  };

  const lobsterId = String(body.lobsterId || '').trim();
  const content = String(body.content || '').trim();

  if (!lobsterId || !content) {
    return NextResponse.json({ ok: false, error: '缺少会话参数' }, { status: 400 });
  }

  try {
    const result = await sendPlatformClawSwarmConversationMessage({
      userId: session.user.id,
      lobsterId,
      content,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '发送消息失败' },
      { status: resolveStatusCode(error) },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { PLATFORM_SESSION_COOKIE_NAME } from '@/lib/platform-auth-constants';
import { getPlatformSession, getPlatformLobster } from '@/lib/server/platform-repo';
import { sendPlatformChatCompletion, type ChatMessageDraft } from '@/lib/server/platform-chat';

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(PLATFORM_SESSION_COOKIE_NAME)?.value ?? '';
  const session = await getPlatformSession(sessionId);
  if (!session) {
    return NextResponse.json({ ok: false, error: '请先登录平台账号' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    lobsterId?: string;
    messages?: Array<{ role?: string; content?: string }>;
  };

  const lobsterId = String(body.lobsterId || '').trim();
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (!lobsterId || !messages.length) {
    return NextResponse.json({ ok: false, error: '缺少对话参数' }, { status: 400 });
  }

  const lobster = await getPlatformLobster(session.user.id, lobsterId);
  if (!lobster) {
    return NextResponse.json({ ok: false, error: '龙虾不存在或不属于当前账号' }, { status: 404 });
  }

  try {
    const normalizedMessages: ChatMessageDraft[] = messages
      .map((item) => ({
        role: (item.role === 'assistant' ? 'assistant' : 'user') as ChatMessageDraft['role'],
        content: String(item.content || ''),
      }))
      .filter((item) => item.content.trim());

    const result = await sendPlatformChatCompletion({
      modelRef: lobster.modelRef,
      messages: normalizedMessages,
    });
    return NextResponse.json({ ok: true, content: result.content });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '对话失败' },
      { status: 500 },
    );
  }
}

'use server';

import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import {
  authenticatePlatformUser,
  bindLobsterModel,
  createPlatformLobster,
  createPlatformProvider,
  createPlatformSession,
  createPlatformUser,
  deletePlatformLobster,
  updatePlatformLobster,
} from './platform-repo';
import {
  clearPlatformSessionCookie,
  createPlatformSessionCookie,
  destroyCurrentPlatformSession,
  requirePlatformUser,
} from './platform-session';

function encodeMessage(message: string) {
  return encodeURIComponent(message);
}

export async function platformLoginAction(formData: FormData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  try {
    const user = await authenticatePlatformUser({ email, password });
    const sessionId = await createPlatformSession(user.id);
    const cookieStore = await import('next/headers').then((mod) => mod.cookies());
    cookieStore.set({
      name: 'openclaw_platform_session',
      value: sessionId,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
    });
    redirect('/home');
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : '登录失败';
    redirect(`/login?error=${encodeMessage(message)}`);
  }
}

export async function platformRegisterAction(formData: FormData) {
  const displayName = String(formData.get('displayName') || '').trim();
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (!displayName || !email || !password) {
    redirect('/register?error=' + encodeMessage('请完整填写昵称、邮箱和密码'));
  }
  if (password.length < 8) {
    redirect('/register?error=' + encodeMessage('密码至少需要 8 位'));
  }
  if (password !== confirmPassword) {
    redirect('/register?error=' + encodeMessage('两次密码输入不一致'));
  }

  try {
    const user = await createPlatformUser({ displayName, email, password });
    const sessionId = await createPlatformSession(user.id);
    const cookieStore = await import('next/headers').then((mod) => mod.cookies());
    cookieStore.set({
      name: 'openclaw_platform_session',
      value: sessionId,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
    });
    redirect('/home?welcome=1');
  } catch (error) {
    if (isRedirectError(error)) throw error;
    const message = error instanceof Error ? error.message : '注册失败';
    redirect(`/register?error=${encodeMessage(message)}`);
  }
}

export async function platformLogoutAction() {
  await destroyCurrentPlatformSession();
  const cookieStore = await import('next/headers').then((mod) => mod.cookies());
  cookieStore.set({
    name: 'openclaw_platform_session',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  redirect('/login');
}

export async function createLobsterAction(formData: FormData) {
  const user = await requirePlatformUser();
  const name = String(formData.get('name') || '').trim();
  const archetype = String(formData.get('archetype') || '').trim();
  if (!name) {
    redirect('/lobsters?error=' + encodeMessage('请输入龙虾名称'));
  }
  await createPlatformLobster({ userId: user.id, name, archetype });
  redirect('/lobsters?created=1');
}

export async function updateLobsterAction(formData: FormData) {
  const user = await requirePlatformUser();
  const lobsterId = String(formData.get('lobsterId') || '').trim();
  const name = String(formData.get('name') || '').trim();
  const archetype = String(formData.get('archetype') || '').trim();

  if (!lobsterId || !name) {
    redirect('/lobsters?error=' + encodeMessage('请填写龙虾名称'));
  }

  await updatePlatformLobster({
    userId: user.id,
    lobsterId,
    name,
    archetype,
  });
  redirect('/lobsters?updated=1');
}

export async function deleteLobsterAction(formData: FormData) {
  const user = await requirePlatformUser();
  const lobsterId = String(formData.get('lobsterId') || '').trim();
  if (!lobsterId) {
    redirect('/lobsters?error=' + encodeMessage('缺少龙虾标识'));
  }
  await deletePlatformLobster({ userId: user.id, lobsterId });
  redirect('/lobsters?deleted=1');
}

export async function createPrivateProviderAction(formData: FormData) {
  const user = await requirePlatformUser();
  const name = String(formData.get('name') || '').trim();
  const type = String(formData.get('type') || 'openai-compatible') as 'openai-compatible' | 'anthropic' | 'gemini' | 'ollama';
  const baseUrl = String(formData.get('baseUrl') || '').trim();
  const apiKey = String(formData.get('apiKey') || '').trim();
  const modelId = String(formData.get('modelId') || '').trim();
  const modelName = String(formData.get('modelName') || '').trim();
  const isDefault = String(formData.get('isDefault') || '') === 'on';

  if (!name || !baseUrl || !modelId) {
    redirect('/models?error=' + encodeMessage('请至少填写名称、Base URL 和模型 ID'));
  }
  if (type !== 'ollama' && !apiKey) {
    redirect('/models?error=' + encodeMessage('该 Provider 需要 API Key'));
  }

  await createPlatformProvider({
    userId: user.id,
    name,
    type,
    baseUrl,
    apiKey,
    modelId,
    modelName,
    isDefault,
  });
  redirect('/models?created=1');
}

export async function bindLobsterModelAction(formData: FormData) {
  const user = await requirePlatformUser();
  const lobsterId = String(formData.get('lobsterId') || '').trim();
  const modelRef = String(formData.get('modelRef') || '').trim();
  const providerId = String(formData.get('providerId') || '').trim();

  if (!lobsterId || !modelRef) {
    redirect('/lobsters?error=' + encodeMessage('请选择要绑定的模型'));
  }

  await bindLobsterModel({
    userId: user.id,
    lobsterId,
    modelRef,
    providerId: providerId || undefined,
  });
  redirect('/lobsters?bound=1');
}

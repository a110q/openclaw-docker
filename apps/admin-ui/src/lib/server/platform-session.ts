import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PLATFORM_SESSION_COOKIE_NAME } from '@/lib/platform-auth-constants';
import { getPlatformEnv } from './platform-env';
import { deletePlatformSession, getPlatformSession } from './platform-repo';

export function createPlatformSessionCookie(value: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const ttlSeconds = getPlatformEnv().OPENCLAW_PLATFORM_SESSION_TTL_DAYS * 24 * 60 * 60;
  return `${PLATFORM_SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; Max-Age=${ttlSeconds}; SameSite=Lax${secure}`;
}

export function clearPlatformSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${PLATFORM_SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${secure}`;
}

export async function getPlatformSessionCookieValue() {
  const store = await cookies();
  return store.get(PLATFORM_SESSION_COOKIE_NAME)?.value ?? '';
}

export async function getCurrentPlatformSession() {
  return getPlatformSession(await getPlatformSessionCookieValue());
}

export async function requirePlatformUser() {
  const session = await getCurrentPlatformSession();
  if (!session) {
    redirect('/login');
  }
  return session.user;
}

export async function destroyCurrentPlatformSession() {
  const sessionId = await getPlatformSessionCookieValue();
  if (sessionId) {
    await deletePlatformSession(sessionId);
  }
}

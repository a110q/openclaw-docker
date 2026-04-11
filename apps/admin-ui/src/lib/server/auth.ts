import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME } from '@/lib/admin-auth-constants';
import { getAdminEnv } from './env';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export async function verifyAdminToken(input: string, expected: string) {
  return input === expected;
}

export function createAdminSessionValue(token: string) {
  return token;
}

export function createAdminSessionCookie(value: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; Max-Age=${SESSION_TTL_SECONDS}; SameSite=Lax${secure}`;
}

export function clearAdminSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${secure}`;
}

export function expectedSessionValue() {
  return getAdminEnv().OPENCLAW_ADMIN_UI_TOKEN;
}

export async function getSessionCookieValue() {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? '';
}

export async function isAuthenticated() {
  const current = await getSessionCookieValue();
  return current === expectedSessionValue();
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

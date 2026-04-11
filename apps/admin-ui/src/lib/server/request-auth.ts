import { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/admin-auth-constants';

export function requireAdminRequest(request: NextRequest) {
  const sessionValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return sessionValue === (process.env.OPENCLAW_ADMIN_UI_TOKEN ?? '');
}

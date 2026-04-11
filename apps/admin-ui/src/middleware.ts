import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/admin-auth-constants';

const PUBLIC_API_PATHS = new Set(['/api/admin/v1/session/login']);

function isStaticPath(pathname: string) {
  return pathname.startsWith('/_next') || pathname === '/favicon.ico';
}

function isAdminPage(pathname: string) {
  return (
    pathname.startsWith('/overview') ||
    pathname.startsWith('/services') ||
    pathname.startsWith('/models/providers') ||
    pathname.startsWith('/models/bindings') ||
    pathname.startsWith('/agents') ||
    pathname.startsWith('/alerts') ||
    pathname.startsWith('/activity') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/capabilities')
  );
}

function isPlatformPublicPage(pathname: string) {
  return pathname === '/' || pathname === '/login' || pathname === '/register' || pathname === '/ops/login';
}

function isPlatformUserPage(pathname: string) {
  return pathname === '/home' || pathname.startsWith('/home/') || pathname === '/lobsters' || pathname.startsWith('/lobsters/') || pathname === '/chat' || pathname.startsWith('/chat/') || pathname === '/models';
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticPath(pathname) || PUBLIC_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const adminPage = isAdminPage(pathname);
  const platformPublicPage = isPlatformPublicPage(pathname);
  const platformUserPage = isPlatformUserPage(pathname);
  const adminApi = pathname.startsWith('/api/admin/v1');

  if (!adminPage && !adminApi && !platformPublicPage && !platformUserPage) {
    return NextResponse.next();
  }

  const expectedToken = process.env.OPENCLAW_ADMIN_UI_TOKEN ?? '';
  const adminSessionValue = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? '';
  const adminAuthenticated = Boolean(expectedToken) && adminSessionValue === expectedToken;
  const platformAuthenticated = Boolean(request.cookies.get('openclaw_platform_session')?.value ?? '');

  if (pathname === '/ops/login') {
    return adminAuthenticated ? NextResponse.redirect(new URL('/overview', request.url)) : NextResponse.next();
  }

  if (pathname === '/login' || pathname === '/register') {
    return platformAuthenticated ? NextResponse.redirect(new URL('/home', request.url)) : NextResponse.next();
  }

  if (platformPublicPage) {
    return NextResponse.next();
  }

  if (platformUserPage) {
    return platformAuthenticated ? NextResponse.next() : NextResponse.redirect(new URL('/login', request.url));
  }

  if (adminAuthenticated) {
    return NextResponse.next();
  }

  if (adminApi) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.redirect(new URL('/ops/login', request.url));
}

export const config = {
  matcher: ['/((?!.*\\..*).*)']
};

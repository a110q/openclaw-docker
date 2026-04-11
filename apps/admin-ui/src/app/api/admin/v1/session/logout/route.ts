import { NextRequest, NextResponse } from 'next/server';
import { clearAdminSessionCookie } from '@/lib/server/auth';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.headers.append('Set-Cookie', clearAdminSessionCookie());
  return response;
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to protect student_page and teacher_page routes.
 * 
 * IMPORTANT: This middleware CANNOT import from auth.ts or any file that imports
 * Mongoose/bcrypt, as those are not compatible with Edge Runtime.
 * 
 * We only check for the presence of authentication cookies here.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect student_page routes
  if (pathname.startsWith('/student_page')) {
    // Check for NextAuth session token (Google OAuth)
    const nextAuthToken = 
      request.cookies.get('authjs.session-token')?.value || 
      request.cookies.get('__Secure-authjs.session-token')?.value;
    
    // Check for manual auth tokens (email/password login)
    const accessToken = request.cookies.get('accessToken')?.value;
    const refreshToken = request.cookies.get('refreshToken')?.value;

    // If no authentication cookies exist, redirect to login
    if (!nextAuthToken && !accessToken && !refreshToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.search = `?redirect=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  // Protect teacher_page routes
  if (pathname.startsWith('/teacher_page')) {
    // Check for NextAuth session token (Google OAuth)
    const nextAuthToken = 
      request.cookies.get('authjs.session-token')?.value || 
      request.cookies.get('__Secure-authjs.session-token')?.value;
    
    // Check for manual auth tokens (email/password login)
    const accessToken = request.cookies.get('accessToken')?.value;
    const refreshToken = request.cookies.get('refreshToken')?.value;

    // If no authentication cookies exist, redirect to login
    if (!nextAuthToken && !accessToken && !refreshToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.search = `?redirect=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/student_page/:path*',
    '/teacher_page/:path*',
  ],
};
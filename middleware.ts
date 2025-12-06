/*
 * Copyright 2025 Kharl Ryan M. De Jesus
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Advanced Middleware for GC Quest
 * 
 * Features:
 * - Authentication checks for protected routes
 * - Role-based access control
 * - Rate limiting headers
 * - Security headers
 * - Redirect logic for authenticated users on auth pages
 * 
 * IMPORTANT: This middleware CANNOT import from auth.ts or any file that imports
 * Mongoose/bcrypt, as those are not compatible with Edge Runtime.
 */

// Rate limiting configuration (simple in-memory for Edge)
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Helper function to check if user is authenticated
  const isAuthenticated = () => {
    const nextAuthTokens = [
      'authjs.session-token',
      '__Secure-authjs.session-token',
      'next-auth.session-token',
      '__Secure-next-auth.session-token'
    ];
    
    const hasNextAuthToken = nextAuthTokens.some(name => 
      request.cookies.get(name)?.value
    );
    
    const accessToken = request.cookies.get('accessToken')?.value;
    const refreshToken = request.cookies.get('refreshToken')?.value;

    return hasNextAuthToken || accessToken || refreshToken;
  };

  // Helper to get user role from cookie (set during login)
  const getUserRole = (): string | null => {
    const roleCookie = request.cookies.get('userRole')?.value;
    return roleCookie || null;
  };

  // Redirect authenticated users away from auth pages
  if (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/register')) {
    if (isAuthenticated()) {
      const role = getUserRole();
      const url = request.nextUrl.clone();
      
      // Redirect to appropriate dashboard based on role
      if (role === 'teacher') {
        url.pathname = '/teacher_page/dashboard';
      } else if (role === 'coordinator') {
        url.pathname = '/coordinator_page';
      } else if (role === 'parent') {
        url.pathname = '/parent_page';
      } else {
        url.pathname = '/student_page/dashboard';
      }
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  // Protect student_page routes
  if (pathname.startsWith('/student_page')) {
    if (!isAuthenticated()) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.search = `?redirect=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    
    // Optional: Check role for student pages
    const role = getUserRole();
    if (role && role !== 'student' && role !== 'teacher' && role !== 'coordinator') {
      // Allow teachers and coordinators to view student pages for support
      // But redirect parents to their own page
      if (role === 'parent') {
        const url = request.nextUrl.clone();
        url.pathname = '/parent_page';
        return NextResponse.redirect(url);
      }
    }
  }

  // Protect teacher_page routes
  if (pathname.startsWith('/teacher_page')) {
    if (!isAuthenticated()) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.search = `?redirect=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    
    // Check role for teacher pages - only teachers and coordinators allowed
    const role = getUserRole();
    if (role && role !== 'teacher' && role !== 'coordinator') {
      const url = request.nextUrl.clone();
      if (role === 'student') {
        url.pathname = '/student_page/dashboard';
      } else if (role === 'parent') {
        url.pathname = '/parent_page';
      } else {
        url.pathname = '/auth/login';
      }
      return NextResponse.redirect(url);
    }
  }

  // Protect coordinator_page routes
  if (pathname.startsWith('/coordinator_page')) {
    if (!isAuthenticated()) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.search = `?redirect=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    
    // Only coordinators can access coordinator pages
    const role = getUserRole();
    if (role && role !== 'coordinator') {
      const url = request.nextUrl.clone();
      if (role === 'teacher') {
        url.pathname = '/teacher_page/dashboard';
      } else if (role === 'student') {
        url.pathname = '/student_page/dashboard';
      } else if (role === 'parent') {
        url.pathname = '/parent_page';
      } else {
        url.pathname = '/auth/login';
      }
      return NextResponse.redirect(url);
    }
  }

  // Protect parent_page routes
  if (pathname.startsWith('/parent_page')) {
    if (!isAuthenticated()) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.search = `?redirect=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  // API rate limiting headers (informational)
  if (pathname.startsWith('/api/')) {
    response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
    response.headers.set('X-RateLimit-Window', String(RATE_LIMIT_WINDOW));
  }

  return response;
}

export const config = {
  matcher: [
    '/student_page/:path*',
    '/teacher_page/:path*',
    '/coordinator_page/:path*',
    '/parent_page/:path*',
    '/auth/login',
    '/auth/register',
    '/api/:path*',
  ],
};
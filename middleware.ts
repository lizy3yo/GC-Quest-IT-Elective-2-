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
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

import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiting store
const requestCounts = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message: string;
}

/**
 * Next.js compatible rate limiter
 * @param options Rate limiting configuration
 * @returns Function to check rate limit for a request
 */
export const createRateLimit = (options: RateLimitOptions) => {
  const { windowMs, max, message } = options;
  
  return (request: NextRequest) => {
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [key, value] of requestCounts.entries()) {
      if (now > value.resetTime) {
        requestCounts.delete(key);
      }
    }
    
    const current = requestCounts.get(ip);
    
    if (!current || now > current.resetTime) {
      // First request or window expired, reset
      requestCounts.set(ip, {
        count: 1,
        resetTime: now + windowMs
      });
      return { success: true };
    }
    
    if (current.count >= max) {
      // Rate limit exceeded
      return {
        success: false,
        error: message,
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      };
    }
    
    // Increment count
    current.count++;
    requestCounts.set(ip, current);
    
    return { success: true };
  };
};

// Default rate limiter: 100 requests per 15 minutes
const defaultLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

export default defaultLimiter;
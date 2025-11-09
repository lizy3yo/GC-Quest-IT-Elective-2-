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

import { authManager } from '@/utils/auth';
import cache, { getCacheStats, clearCache } from './cache';

/**
 * Improved ApiClient.request:
 * - Reads accessToken from localStorage and sets Authorization header.
 * - Sends credentials: 'include' to ensure refresh cookie is sent.
 * - On 401, attempts to refresh token at /api/v1/auth/refresh-token and retries once.
 * - Persists refreshed accessToken to localStorage.
 */
export class ApiClient {
  base = "/api/v1";

  private async tryRefresh(): Promise<string | null> {
    try {
      const res = await fetch(`${this.base}/auth/refresh-token`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
        return data.accessToken;
      }
      return null;
    } catch (err) {
      console.warn("Token refresh failed:", err);
      return null;
    }
  }

  // Main request wrapper
  public async request(path: string, options: RequestInit = {}) {
    // If path is a full URL use it. If path already targets an /api/ route, don't prefix the default base
    const url = path.startsWith("http")
      ? path
      : path.startsWith('/api/')
        ? path
        : `${this.base}${path.startsWith("/") ? path : "/" + path}`;

    // ensure headers object
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (!headers.get("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const attachToken = (token?: string | null) => {
      if (token) headers.set("Authorization", `Bearer ${token}`);
      else headers.delete("Authorization");
    };

  // attach any existing access token in localStorage
    const stored = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    attachToken(stored);

    const reqOpts: RequestInit = {
      ...options,
      headers,
      credentials: "include", // ensure cookies (refresh token) are sent
    };

    // Simple GET caching (client-side):
    // - Default: cache same-origin API calls (paths containing '/api/') for 60s
    // - Override TTL with header 'x-cache-ttl' (seconds)
    // - Disable caching by setting header 'x-cache' to 'no'
    const method = (reqOpts.method || 'GET').toString().toUpperCase();
    let cacheTtl = 0;
    if (method === 'GET') {
      const headerTtl = headers.get('x-cache-ttl');
      const headerCache = headers.get('x-cache');
      if (headerCache && headerCache.toLowerCase() === 'no') {
        cacheTtl = 0;
      } else if (headerTtl && !isNaN(Number(headerTtl))) {
        cacheTtl = Math.max(0, Number(headerTtl));
      } else if (url.includes('/api/')) {
        cacheTtl = 60; // default TTL for API calls (seconds)
      }

      if (cacheTtl > 0) {
        const cached = cache.get(url);
        if (cached !== null) {
          // cache hit — return cached body immediately
          console.debug(`[api] cache hit: ${url}`);
          return cached;
        }
        console.debug(`[api] cache miss: ${url}`);
        // remove cache control headers before sending to server
        headers.delete('x-cache-ttl');
        headers.delete('x-cache');
      }
    }

    let res = await fetch(url, reqOpts);

    // If 401, attempt refresh -> retry once
    if (res.status === 401) {
      const newToken = await this.tryRefresh();
      if (newToken) {
        attachToken(newToken);
        const retryOpts: RequestInit = {
          ...options,
          headers,
          credentials: "include",
        };
        res = await fetch(url, retryOpts);
      }
    }

    // Parse response
    const contentType = res.headers.get("Content-Type") || "";
    let body: any = null;
    if (contentType.includes("application/json")) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => null);
    }

    if (!res.ok) {
      const message = body?.message || body?.error || `Request failed (${res.status})`;
      const err: any = new Error(message);
      err.status = res.status;
      err.body = body;
      throw err;
    }

    // store GET responses in cache when applicable
    if (method === 'GET' && cacheTtl > 0) {
      try {
        cache.set(url, body, cacheTtl);
        // optionally expose cache stats in dev via console
        console.debug('[api] cache set:', { url, ttl: cacheTtl, stats: getCacheStats() });
      } catch (e) {
        // ignore cache set failures
        console.warn('[api] cache set failed', e);
      }
    }

    return body;
  }

  // convenience helpers
  public get(path: string, options: RequestInit = {}) {
    return this.request(path, { ...options, method: "GET" });
  }
  public post(path: string, data?: any, options: RequestInit = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data ?? {});
    const headers = data instanceof FormData ? options.headers : { ...(options.headers || {}) };
    return this.request(path, { ...options, method: "POST", body, headers });
  }
  public patch(path: string, data?: any, options: RequestInit = {}) {
    return this.request(path, { ...options, method: "PATCH", body: JSON.stringify(data ?? {}) });
  }
  public del(path: string, options: RequestInit = {}) {
    return this.request(path, { ...options, method: "DELETE" });
  }
}

const api = new ApiClient();
export default api;
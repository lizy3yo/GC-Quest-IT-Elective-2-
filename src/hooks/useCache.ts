'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Client-side caching hook for React components
 * Uses localStorage with TTL support for persistent caching
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface UseCacheOptions {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: boolean; // Return stale data while fetching fresh
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory cache for current session
const memoryCache = new Map<string, CacheEntry<any>>();

/**
 * Get item from cache (memory first, then localStorage)
 */
function getCachedItem<T>(key: string): T | null {
  // Check memory cache first
  const memEntry = memoryCache.get(key);
  if (memEntry && Date.now() < memEntry.expiresAt) {
    return memEntry.value;
  }

  // Check localStorage
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(`cache:${key}`);
    if (!stored) return null;

    const entry: CacheEntry<T> = JSON.parse(stored);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(`cache:${key}`);
      return null;
    }

    // Populate memory cache
    memoryCache.set(key, entry);
    return entry.value;
  } catch {
    return null;
  }
}

/**
 * Set item in cache (both memory and localStorage)
 */
function setCachedItem<T>(key: string, value: T, ttl: number): void {
  const entry: CacheEntry<T> = {
    value,
    expiresAt: Date.now() + ttl
  };

  // Set in memory
  memoryCache.set(key, entry);

  // Set in localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`cache:${key}`, JSON.stringify(entry));
    } catch (e) {
      // localStorage might be full, clear old entries
      clearExpiredCache();
      try {
        localStorage.setItem(`cache:${key}`, JSON.stringify(entry));
      } catch {
        // Still failed, just use memory cache
      }
    }
  }
}

/**
 * Clear expired cache entries from localStorage
 */
function clearExpiredCache(): void {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('cache:')) {
      try {
        const entry = JSON.parse(localStorage.getItem(key) || '{}');
        if (entry.expiresAt && now > entry.expiresAt) {
          keysToRemove.push(key);
        }
      } catch {
        keysToRemove.push(key);
      }
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Invalidate cache by key or pattern
 */
export function invalidateCache(keyOrPattern: string | RegExp): void {
  if (typeof keyOrPattern === 'string') {
    memoryCache.delete(keyOrPattern);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`cache:${keyOrPattern}`);
    }
  } else {
    // Pattern-based invalidation
    for (const key of memoryCache.keys()) {
      if (keyOrPattern.test(key)) {
        memoryCache.delete(key);
      }
    }

    if (typeof window !== 'undefined') {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith('cache:')) {
          const cacheKey = key.replace('cache:', '');
          if (keyOrPattern.test(cacheKey)) {
            localStorage.removeItem(key);
          }
        }
      }
    }
  }
}

/**
 * Hook for cached data fetching
 */
export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCacheOptions = {}
): {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
} {
  const { ttl = DEFAULT_TTL, staleWhileRevalidate = true } = options;
  
  const [data, setData] = useState<T | null>(() => getCachedItem<T>(key));
  const [isLoading, setIsLoading] = useState(!data);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading && !staleWhileRevalidate) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const result = await fetcherRef.current();
      setCachedItem(key, result, ttl);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to fetch'));
    } finally {
      setIsLoading(false);
    }
  }, [key, ttl, staleWhileRevalidate]);

  useEffect(() => {
    const cached = getCachedItem<T>(key);
    
    if (cached) {
      setData(cached);
      // Revalidate in background if staleWhileRevalidate is enabled
      if (staleWhileRevalidate) {
        fetchData(false);
      }
    } else {
      fetchData(true);
    }
  }, [key, fetchData, staleWhileRevalidate]);

  const invalidate = useCallback(() => {
    invalidateCache(key);
    setData(null);
    fetchData(true);
  }, [key, fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: () => fetchData(true),
    invalidate
  };
}

/**
 * Hook for caching API responses with SWR-like behavior
 */
export function useCachedFetch<T>(
  url: string | null,
  options: RequestInit & UseCacheOptions = {}
): {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const { ttl, staleWhileRevalidate, ...fetchOptions } = options;

  const fetcher = useCallback(async () => {
    if (!url) throw new Error('No URL provided');
    
    const response = await fetch(url, {
      ...fetchOptions,
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }, [url, JSON.stringify(fetchOptions)]);

  return useCache<T>(
    url || 'null',
    fetcher,
    { ttl, staleWhileRevalidate }
  );
}

export default useCache;

/**
 * GC Quest Caching System
 * 
 * A comprehensive in-memory caching solution with:
 * - TTL (Time To Live) support
 * - LRU (Least Recently Used) eviction
 * - Tag-based invalidation
 * - Automatic cleanup
 * - Statistics tracking
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  tags: string[];
  lastAccessed: number;
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  tags?: string[]; // Tags for grouped invalidation
}

// Default TTL values (in milliseconds)
export const CACHE_TTL = {
  SHORT: 30 * 1000,        // 30 seconds - for frequently changing data
  MEDIUM: 5 * 60 * 1000,   // 5 minutes - for moderately changing data
  LONG: 30 * 60 * 1000,    // 30 minutes - for rarely changing data
  HOUR: 60 * 60 * 1000,    // 1 hour
  DAY: 24 * 60 * 60 * 1000 // 24 hours - for static data
} as const;

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private maxSize: number;
  private stats: CacheStats = { hits: 0, misses: 0, size: 0, evictions: 0 };
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    this.startCleanup();
  }

  /**
   * Get a value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.size = this.cache.size;
      this.stats.misses++;
      return null;
    }

    // Update access time and hits
    entry.lastAccessed = Date.now();
    entry.hits++;
    this.stats.hits++;

    return entry.value as T;
  }

  /**
   * Set a value in cache
   */
  set<T>(key: string, value: T, options: CacheOptions = {}): void {
    const { ttl = CACHE_TTL.MEDIUM, tags = [] } = options;

    // Evict if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttl,
      tags,
      lastAccessed: Date.now(),
      hits: 0
    };

    this.cache.set(key, entry);
    this.stats.size = this.cache.size;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.stats.size = this.cache.size;
    return result;
  }

  /**
   * Invalidate all entries with a specific tag
   */
  invalidateByTag(tag: string): number {
    let count = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * Invalidate entries matching a pattern
   */
  invalidateByPattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let count = 0;
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    this.stats.size = this.cache.size;
    return count;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { hitRate: string } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) + '%' : '0%';
    return { ...this.stats, hitRate };
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, options);
    return value;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanup(): void {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
        }
      }
      this.stats.size = this.cache.size;
    }, 60 * 1000);

    // Prevent interval from keeping Node.js process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
let cacheInstance: MemoryCache | null = null;

export function getCache(): MemoryCache {
  if (!cacheInstance) {
    cacheInstance = new MemoryCache(2000); // Max 2000 entries
  }
  return cacheInstance;
}

// Cache key generators for consistent key naming
export const cacheKeys = {
  // User-related
  user: (userId: string) => `user:${userId}`,
  userClasses: (userId: string) => `user:${userId}:classes`,
  userFlashcards: (userId: string) => `user:${userId}:flashcards`,
  userSummaries: (userId: string) => `user:${userId}:summaries`,
  userPracticeTests: (userId: string) => `user:${userId}:practice-tests`,
  
  // Class-related
  class: (classId: string) => `class:${classId}`,
  classStudents: (classId: string) => `class:${classId}:students`,
  classAssessments: (classId: string) => `class:${classId}:assessments`,
  classResources: (classId: string) => `class:${classId}:resources`,
  
  // Assessment-related
  assessment: (assessmentId: string) => `assessment:${assessmentId}`,
  assessmentSubmissions: (assessmentId: string) => `assessment:${assessmentId}:submissions`,
  
  // Leaderboard
  leaderboard: (view: string, sortBy: string) => `leaderboard:${view}:${sortBy}`,
  studentLeaderboard: (view: string, sortBy: string) => `student-leaderboard:${view}:${sortBy}`,
  
  // Analytics
  analytics: (teacherId: string, range: string) => `analytics:${teacherId}:${range}`,
  dashboardMetrics: (teacherId: string) => `dashboard-metrics:${teacherId}`,
  
  // Resources
  publicResources: (subject: string) => `public-resources:${subject}`,
  
  // Coordinator
  coordinatorOverview: (range: string) => `coordinator:overview:${range}`,
  coordinatorTeachers: () => `coordinator:teachers`,
  coordinatorStudents: () => `coordinator:students`,
};

// Cache tags for grouped invalidation
export const cacheTags = {
  user: (userId: string) => `user:${userId}`,
  class: (classId: string) => `class:${classId}`,
  assessment: (assessmentId: string) => `assessment:${assessmentId}`,
  leaderboard: 'leaderboard',
  analytics: 'analytics',
  coordinator: 'coordinator',
};

// Export the cache instance for direct use
export const cache = getCache();

export default cache;

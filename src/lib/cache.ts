/**
 * Simple in-memory TTL cache for client-side use.
 * - Stores values in a Map with expiry timestamps.
 * - Provides get/set/del/clear and stats helpers.
 * - Intended for small amounts of short-lived data (API responses).
 */
type CacheEntry = {
  value: any;
  expiresAt: number; // ms epoch
};

class SimpleCache {
  private store = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  get(key: string) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value;
  }

  set(key: string, value: any, ttlSeconds = 60) {
    const ttl = Math.max(0, ttlSeconds);
    const expiresAt = Date.now() + ttl * 1000;
    this.store.set(key, { value, expiresAt });
  }

  del(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats() {
    return {
      entries: this.store.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

const cache = new SimpleCache();

export default cache;
export const getCacheStats = () => cache.stats();
export const clearCache = () => cache.clear();
export const delCache = (key: string) => cache.del(key);

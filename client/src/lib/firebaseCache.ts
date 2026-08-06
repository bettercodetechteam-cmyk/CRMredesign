/**
 * Firebase Cache Manager
 * Implements intelligent caching to reduce Firebase quota usage
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  useLocalStorage?: boolean;
  storageKey?: string;
}

class FirebaseCache {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  /**
   * Get cached data or return null if expired/not found
   */
  get<T>(key: string): T | null {
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && this.isValid(memoryEntry)) {
      return memoryEntry.data as T;
    }

    // Try localStorage if enabled
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`firebase_cache_${key}`);
        if (stored) {
          const entry: CacheEntry<T> = JSON.parse(stored);
          if (this.isValid(entry)) {
            // Restore to memory cache
            this.memoryCache.set(key, entry);
            return entry.data;
          } else {
            // Remove expired entry
            localStorage.removeItem(`firebase_cache_${key}`);
          }
        }
      } catch (error) {
        console.warn('Error reading from localStorage cache:', error);
      }
    }

    return null;
  }

  /**
   * Set cache entry with TTL
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl || this.defaultTTL;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };

    // Store in memory
    this.memoryCache.set(key, entry);

    // Store in localStorage if enabled
    if (options.useLocalStorage && typeof window !== 'undefined') {
      try {
        const storageKey = options.storageKey || `firebase_cache_${key}`;
        localStorage.setItem(storageKey, JSON.stringify(entry));
      } catch (error) {
        // localStorage might be full, just continue with memory cache
        console.warn('Error writing to localStorage cache:', error);
      }
    }
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`firebase_cache_${key}`);
      } catch (error) {
        // Ignore errors
      }
    }
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    // Clear memory cache
    const keysToDelete: string[] = [];
    this.memoryCache.forEach((_, key) => {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.memoryCache.delete(key));

    // Clear localStorage cache
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.includes(`firebase_cache_${pattern}`)) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        // Ignore errors
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('firebase_cache_')) {
            localStorage.removeItem(key);
          }
        });
      } catch (error) {
        // Ignore errors
      }
    }
  }

  /**
   * Get or set with async function (cached fetch pattern)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch and cache
    try {
      const data = await fetchFn();
      this.set(key, data, options);
      return data;
    } catch (error) {
      // If fetch fails, try to return stale cache if available
      const stale = this.memoryCache.get(key);
      if (stale) {
        console.warn('Fetch failed, using stale cache:', error);
        return stale.data as T;
      }
      throw error;
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.memoryCache.forEach((entry, key) => {
      if (!this.isValid(entry)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.memoryCache.delete(key));

    // Clean localStorage
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('firebase_cache_')) {
            try {
              const entry: CacheEntry<any> = JSON.parse(localStorage.getItem(key) || '{}');
              if (now - entry.timestamp >= entry.ttl) {
                localStorage.removeItem(key);
              }
            } catch {
              // Remove invalid entries
              localStorage.removeItem(key);
            }
          }
        });
      } catch (error) {
        // Ignore errors
      }
    }
  }
}

// Export singleton instance
export const firebaseCache = new FirebaseCache();

// Cleanup expired entries every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    firebaseCache.cleanup();
  }, 10 * 60 * 1000);
}

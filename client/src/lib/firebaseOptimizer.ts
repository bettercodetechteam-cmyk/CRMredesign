/**
 * Firebase Optimizer - Reduces quota usage through caching, query limits, and smart fetching
 */

import { collection, query, where, getDocs, limit, orderBy, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

// Cache configuration
// Increased cache duration to reduce Firebase reads
// Cache invalidation on create/update/delete ensures data freshness
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (increased from 30 seconds)
const MAX_QUERY_LIMIT = 500; // Maximum documents per query
const DEFAULT_QUERY_LIMIT = 100; // Default limit for queries

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class FirebaseCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly ttl: number;

  constructor(ttl: number = CACHE_TTL) {
    this.ttl = ttl;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, customTTL?: number): void {
    const now = Date.now();
    const ttl = customTTL || this.ttl;
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl
    });
  }

  invalidate(pattern?: string): void {
    if (pattern) {
      // Invalidate keys matching pattern
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance
const cache = new FirebaseCache(CACHE_TTL);

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Query builder with limits
export function buildOptimizedQuery(
  collectionName: string,
  conditions: Array<{ field: string; operator: any; value: any }> = [],
  options: {
    orderByField?: string;
    orderDirection?: 'asc' | 'desc';
    limitCount?: number;
  } = {}
) {
  if (!db) {
    throw new Error('Database not initialized');
  }

  let q: any = collection(db, collectionName);

  // Apply where conditions
  conditions.forEach(condition => {
    if (condition.value !== undefined && condition.value !== null) {
      q = query(q, where(condition.field, condition.operator, condition.value));
    }
  });

  // Apply ordering
  if (options.orderByField) {
    q = query(q, orderBy(options.orderByField, options.orderDirection || 'desc'));
  }

  // Apply limit (critical for quota management)
  const queryLimit = Math.min(options.limitCount || DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT);
  q = query(q, limit(queryLimit));

  return q;
}

// Optimized fetch with caching
export async function fetchWithCache<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  options: {
    useCache?: boolean;
    cacheTTL?: number;
    forceRefresh?: boolean;
  } = {}
): Promise<T> {
  const { useCache = true, cacheTTL, forceRefresh = false } = options;

  // Check cache first
  if (useCache && !forceRefresh) {
    const cached = cache.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // Fetch from Firebase
  try {
    const data = await queryFn();
    
    // Store in cache
    if (useCache) {
      cache.set(cacheKey, data, cacheTTL);
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching ${cacheKey}:`, error);
    throw error;
  }
}

// Optimized leads fetch
export async function fetchLeadsOptimized(
  centreId?: string,
  options: {
    limitCount?: number;
    orderByField?: string;
    useCache?: boolean;
    forceRefresh?: boolean;
  } = {}
): Promise<any[]> {
  const cacheKey = `leads_${centreId || 'all'}_${options.limitCount || DEFAULT_QUERY_LIMIT}`;
  
  return fetchWithCache(
    cacheKey,
    async () => {
      const conditions = centreId 
        ? [{ field: 'centreId', operator: '==', value: centreId }]
        : [];
      
      const q = buildOptimizedQuery('leads', conditions, {
        orderByField: options.orderByField || 'createdAt',
        orderDirection: 'desc',
        limitCount: options.limitCount || DEFAULT_QUERY_LIMIT
      });

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },
    {
      useCache: options.useCache !== false,
      forceRefresh: options.forceRefresh
    }
  );
}

// Optimized students fetch
export async function fetchStudentsOptimized(
  centreId?: string,
  options: {
    limitCount?: number;
    useCache?: boolean;
    forceRefresh?: boolean;
  } = {}
): Promise<any[]> {
  const cacheKey = `students_${centreId || 'all'}_${options.limitCount || DEFAULT_QUERY_LIMIT}`;
  
  return fetchWithCache(
    cacheKey,
    async () => {
      const conditions = centreId 
        ? [{ field: 'centreId', operator: '==', value: centreId }]
        : [];
      
      const q = buildOptimizedQuery('students', conditions, {
        orderByField: 'createdAt',
        orderDirection: 'desc',
        limitCount: options.limitCount || DEFAULT_QUERY_LIMIT
      });

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    },
    {
      useCache: options.useCache !== false,
      forceRefresh: options.forceRefresh
    }
  );
}

// Polling-based data fetcher (alternative to real-time listeners)
export class PollingDataFetcher<T> {
  private intervalId: NodeJS.Timeout | null = null;
  private fetchFn: () => Promise<T>;
  private onUpdate: (data: T) => void;
  private pollInterval: number;
  private cacheKey: string;
  private isActive: boolean = false;

  constructor(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    onUpdate: (data: T) => void,
    pollInterval: number = 60000 // 1 minute default
  ) {
    this.cacheKey = cacheKey;
    this.fetchFn = fetchFn;
    this.onUpdate = onUpdate;
    this.pollInterval = pollInterval;
  }

  start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    
    // Initial fetch
    this.fetch();
    
    // Set up polling
    this.intervalId = setInterval(() => {
      this.fetch();
    }, this.pollInterval);
  }

  private async fetch(): Promise<void> {
    try {
      const data = await fetchWithCache(
        this.cacheKey,
        this.fetchFn,
        { useCache: false, forceRefresh: true }
      );
      this.onUpdate(data);
    } catch (error) {
      console.error(`Error in polling fetch for ${this.cacheKey}:`, error);
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isActive = false;
  }

  updateInterval(newInterval: number): void {
    this.pollInterval = newInterval;
    if (this.isActive) {
      this.stop();
      this.start();
    }
  }
}

// Batch operations helper
export async function batchFetch<T>(
  fetchFunctions: Array<() => Promise<T>>,
  options: {
    maxConcurrent?: number;
    delayBetweenBatches?: number;
  } = {}
): Promise<T[]> {
  const { maxConcurrent = 3, delayBetweenBatches = 100 } = options;
  const results: T[] = [];

  for (let i = 0; i < fetchFunctions.length; i += maxConcurrent) {
    const batch = fetchFunctions.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(batch.map(fn => fn()));
    results.push(...batchResults);

    // Delay between batches to avoid quota issues
    if (i + maxConcurrent < fetchFunctions.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return results;
}

// Cache invalidation helpers
export function invalidateLeadsCache(centreId?: string): void {
  if (centreId) {
    cache.invalidate(`leads_${centreId}`);
  } else {
    cache.invalidate('leads');
  }
}

export function invalidateStudentsCache(centreId?: string): void {
  if (centreId) {
    cache.invalidate(`students_${centreId}`);
  } else {
    cache.invalidate('students');
  }
}

export function clearAllCache(): void {
  cache.clear();
}

// Connection check optimization - only check once per session
let connectionChecked = false;
let connectionCheckTime = 0;
const CONNECTION_CHECK_INTERVAL = 300000; // 5 minutes

export async function checkConnectionOptimized(): Promise<boolean> {
  const now = Date.now();
  
  // Skip if checked recently
  if (connectionChecked && (now - connectionCheckTime) < CONNECTION_CHECK_INTERVAL) {
    return true;
  }

  if (!db) {
    return false;
  }

  try {
    // Use a minimal query to check connection
    const testQuery = query(collection(db, 'leads'), limit(1));
    await getDocs(testQuery);
    connectionChecked = true;
    connectionCheckTime = now;
    return true;
  } catch (error) {
    connectionChecked = false;
    return false;
  }
}

// Export cache for manual control
export { cache, FirebaseCache };

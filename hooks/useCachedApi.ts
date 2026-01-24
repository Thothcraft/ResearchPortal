/**
 * Optimized API hook with caching, deduplication, and smart refetching.
 * 
 * Features:
 * - In-memory cache with TTL
 * - Request deduplication (prevents duplicate concurrent requests)
 * - Stale-while-revalidate pattern
 * - Background refresh
 * - Error retry with exponential backoff
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Cache configuration
const DEFAULT_CACHE_TTL = 30000; // 30 seconds
const STALE_TTL = 60000; // 1 minute - data is stale but usable
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// Global cache store
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  error?: Error;
}

const cache = new Map<string, CacheEntry<any>>();
const pendingRequests = new Map<string, Promise<any>>();

// Cache utilities
export function getCacheKey(url: string, params?: Record<string, any>): string {
  if (!params) return url;
  const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return `${url}?${sortedParams}`;
}

export function clearCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  const keys = Array.from(cache.keys());
  keys.forEach(key => {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  });
}

export function invalidateCache(url: string): void {
  cache.delete(url);
}

// Check if cache entry is fresh
function isFresh(entry: CacheEntry<any>, ttl: number = DEFAULT_CACHE_TTL): boolean {
  return Date.now() - entry.timestamp < ttl;
}

// Check if cache entry is stale but usable
function isStale(entry: CacheEntry<any>): boolean {
  return Date.now() - entry.timestamp < STALE_TTL;
}

export interface UseCachedApiOptions {
  cacheTTL?: number;
  staleWhileRevalidate?: boolean;
  retryOnError?: boolean;
  deduplicate?: boolean;
}

export interface CachedApiResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  mutate: (data?: T) => void;
  refetch: () => Promise<T | null>;
}

export function useCachedApi() {
  const { user } = useAuth();
  const tokenRef = useRef(user?.token);
  tokenRef.current = user?.token;
  const abortControllerRef = useRef<AbortController | null>(null);

  const getAuthHeaders = useCallback(() => {
    const token = tokenRef.current;
    if (!token) {
      throw new Error('No authentication token available');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }, []);

  const fetchWithRetry = useCallback(async (
    url: string,
    options: RequestInit,
    retries: number = MAX_RETRIES
  ): Promise<Response> => {
    try {
      const response = await fetch(url, options);
      if (!response.ok && response.status >= 500 && retries > 0) {
        await new Promise(r => setTimeout(r, RETRY_DELAY * (MAX_RETRIES - retries + 1)));
        return fetchWithRetry(url, options, retries - 1);
      }
      return response;
    } catch (error) {
      if (retries > 0 && !(error instanceof DOMException && error.name === 'AbortError')) {
        await new Promise(r => setTimeout(r, RETRY_DELAY * (MAX_RETRIES - retries + 1)));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }, []);

  const get = useCallback(async <T = any>(
    endpoint: string,
    options: UseCachedApiOptions = {}
  ): Promise<T | null> => {
    const {
      cacheTTL = DEFAULT_CACHE_TTL,
      staleWhileRevalidate = true,
      retryOnError = true,
      deduplicate = true,
    } = options;

    const url = `https://web-production-d7d37.up.railway.app${endpoint}`;
    const cacheKey = getCacheKey(endpoint);

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && isFresh(cached, cacheTTL)) {
      return cached.data as T;
    }

    // If stale but usable and we have a pending request, return stale data
    if (cached && isStale(cached) && staleWhileRevalidate) {
      // Trigger background revalidation
      if (!pendingRequests.has(cacheKey)) {
        pendingRequests.set(cacheKey, (async () => {
          try {
            const response = await fetchWithRetry(url, {
              method: 'GET',
              headers: getAuthHeaders(),
            }, retryOnError ? MAX_RETRIES : 0);
            
            if (response.ok) {
              const data = await response.json();
              cache.set(cacheKey, { data, timestamp: Date.now() });
            }
          } finally {
            pendingRequests.delete(cacheKey);
          }
        })());
      }
      return cached.data as T;
    }

    // Deduplicate concurrent requests
    if (deduplicate && pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey) as Promise<T>;
    }

    // Make the request
    const requestPromise = (async () => {
      try {
        const response = await fetchWithRetry(url, {
          method: 'GET',
          headers: getAuthHeaders(),
        }, retryOnError ? MAX_RETRIES : 0);

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = '/auth';
            return null;
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        cache.set(cacheKey, { data, timestamp: Date.now() });
        return data as T;
      } finally {
        pendingRequests.delete(cacheKey);
      }
    })();

    if (deduplicate) {
      pendingRequests.set(cacheKey, requestPromise);
    }

    return requestPromise;
  }, [getAuthHeaders, fetchWithRetry]);

  const post = useCallback(async <T = any>(
    endpoint: string,
    data: any,
    invalidatePatterns?: string[]
  ): Promise<T | null> => {
    const url = `https://web-production-d7d37.up.railway.app${endpoint}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = '/auth';
        return null;
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
    }

    // Invalidate related cache entries
    if (invalidatePatterns) {
      invalidatePatterns.forEach(pattern => clearCache(pattern));
    }

    return response.json();
  }, [getAuthHeaders]);

  const del = useCallback(async (
    endpoint: string,
    invalidatePatterns?: string[]
  ): Promise<boolean> => {
    const url = `https://web-production-d7d37.up.railway.app${endpoint}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = '/auth';
        return false;
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
    }

    // Invalidate related cache entries
    if (invalidatePatterns) {
      invalidatePatterns.forEach(pattern => clearCache(pattern));
    }

    return true;
  }, [getAuthHeaders]);

  return { get, post, delete: del, clearCache, invalidateCache };
}

/**
 * Hook for fetching data with automatic caching and revalidation
 */
export function useCachedData<T>(
  endpoint: string | null,
  options: UseCachedApiOptions & { 
    refreshInterval?: number;
    initialData?: T;
  } = {}
): CachedApiResult<T> {
  const { get } = useCachedApi();
  const [data, setData] = useState<T | null>(options.initialData || null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(!options.initialData);
  const [isValidating, setIsValidating] = useState(false);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (showLoading = true) => {
    if (!endpoint) return null;
    
    try {
      if (showLoading && !data) setIsLoading(true);
      else setIsValidating(true);
      
      const result = await get<T>(endpoint, options);
      
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
      return result;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsValidating(false);
      }
    }
  }, [endpoint, get, options, data]);

  const mutate = useCallback((newData?: T) => {
    if (newData !== undefined) {
      setData(newData);
      if (endpoint) {
        const cacheKey = getCacheKey(endpoint);
        cache.set(cacheKey, { data: newData, timestamp: Date.now() });
      }
    } else {
      fetchData(false);
    }
  }, [endpoint, fetchData]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    
    // Set up refresh interval if specified
    let intervalId: NodeJS.Timeout | null = null;
    if (options.refreshInterval && options.refreshInterval > 0) {
      intervalId = setInterval(() => fetchData(false), options.refreshInterval);
    }
    
    return () => {
      mountedRef.current = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [endpoint]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    refetch: () => fetchData(true),
  };
}

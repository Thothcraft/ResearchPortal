/** Request deduplication utility to prevent duplicate API calls */

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly CACHE_TTL = 5000; // 5 seconds cache
  private readonly MAX_CACHE_SIZE = 100;

  /**
   * Get a unique key for a request
   */
  private getRequestKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * Execute a request with deduplication
   */
  async execute<T>(
    url: string,
    options?: RequestInit,
    customTTL?: number
  ): Promise<T> {
    const key = this.getRequestKey(url, options);
    const ttl = customTTL || this.CACHE_TTL;

    // Check if there's already a pending request
    const existing = this.pendingRequests.get(key);
    if (existing && Date.now() - existing.timestamp < ttl) {
      console.log(`[DEDUPE] Reusing cached request: ${key}`);
      return existing.promise;
    }

    // Clean up old requests
    this.cleanup();

    // Create new request
    const promise = new Promise<T>((resolve, reject) => {
      const fetchPromise = fetch(url, options)
        .then(async (response) => {
          if (!response.ok) {
            const error = await response.json().catch(() => ({
              detail: response.statusText
            }));
            throw new Error(error.detail || `HTTP ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          resolve(data);
          // Remove from pending after successful completion
          this.pendingRequests.delete(key);
        })
        .catch((error) => {
          reject(error);
          // Remove from pending after error
          this.pendingRequests.delete(key);
        });

      // Store the request
      this.pendingRequests.set(key, {
        promise: fetchPromise,
        timestamp: Date.now(),
        resolve: resolve as any,
        reject: reject as any
      });
    });

    return promise;
  }

  /**
   * Clean up expired requests
   */
  private cleanup() {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.pendingRequests.forEach((request, key) => {
      if (now - request.timestamp > this.CACHE_TTL) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.pendingRequests.delete(key));
    
    // Limit cache size
    if (this.pendingRequests.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.pendingRequests.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest entries
      const toRemove = entries.slice(0, entries.length - this.MAX_CACHE_SIZE);
      toRemove.forEach((entry) => this.pendingRequests.delete(entry[0]));
    }
  }

  /**
   * Clear all pending requests
   */
  clear() {
    this.pendingRequests.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      pendingRequests: this.pendingRequests.size,
      requests: Array.from(this.pendingRequests.entries()).map(([key, req]) => ({
        key,
        age: Date.now() - req.timestamp
      }))
    };
  }
}

// Global instance
export const requestDeduplicator = new RequestDeduplicator();

/**
 * Enhanced fetch with deduplication and error handling
 */
export async function deduplicatedFetch<T>(
  url: string,
  options?: RequestInit,
  ttl?: number
): Promise<T> {
  try {
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers
    };

    const response = await requestDeduplicator.execute<T>(
      url,
      { ...options, headers },
      ttl
    );

    return response;
  } catch (error) {
    console.error(`[DEDUPE] Request failed for ${url}:`, error);
    throw error;
  }
}

/**
 * API wrapper for common endpoints
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || '/api/proxy';
  }

  /**
   * Get models with deduplication
   */
  async getModels(ttl = 10000) {
    return deduplicatedFetch(`${this.baseUrl}/datasets/models`, undefined, ttl);
  }

  /**
   * Get training jobs with deduplication
   */
  async getTrainingJobs(status?: string, ttl = 10000) {
    const url = status 
      ? `${this.baseUrl}/datasets/train/jobs?status=${status}`
      : `${this.baseUrl}/datasets/train/jobs`;
    return deduplicatedFetch(url, undefined, ttl);
  }

  /**
   * Get files with deduplication
   */
  async getFiles(options?: {
    limit?: number;
    offset?: number;
    device_id?: string;
    content_type?: string;
  }, ttl = 5000) {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.device_id) params.append('device_id', options.device_id);
    if (options?.content_type) params.append('content_type', options.content_type);

    const url = `${this.baseUrl}/file/files${params.toString() ? `?${params.toString()}` : ''}`;
    return deduplicatedFetch(url, undefined, ttl);
  }

  /**
   * Get devices with deduplication
   */
  async getDevices(ttl = 5000) {
    return deduplicatedFetch(`${this.baseUrl}/device/devices`, undefined, ttl);
  }
}

// Global API client instance
export const apiClient = new ApiClient();

/**
 * React hook for deduplicated API calls
 */
export function useDeduplicatedApi() {
  return {
    getModels: () => apiClient.getModels(),
    getTrainingJobs: (status?: string) => apiClient.getTrainingJobs(status),
    getFiles: (options?: any) => apiClient.getFiles(options),
    getDevices: () => apiClient.getDevices(),
    clearCache: () => requestDeduplicator.clear(),
    getStats: () => requestDeduplicator.getStats()
  };
}

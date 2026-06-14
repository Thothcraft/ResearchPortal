import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface UseCachedApiOptions {
  retryOnError?: boolean;
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
  const apiBaseUrl = '/api/proxy';
  const tokenRef = useRef(user?.token);
  tokenRef.current = user?.token;

  const getAuthHeaders = useCallback(() => {
    const token = tokenRef.current;
    if (!token) {
      throw new Error('No authentication token available');
    }
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }, []);

  const get = useCallback(async <T = any>(endpoint: string): Promise<T | null> => {
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      cache: 'no-store',
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

    return response.json();
  }, [apiBaseUrl, getAuthHeaders]);

  const post = useCallback(async <T = any>(endpoint: string, data: any): Promise<T | null> => {
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
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

    return response.json();
  }, [apiBaseUrl, getAuthHeaders]);

  const del = useCallback(async (endpoint: string): Promise<boolean> => {
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
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

    return true;
  }, [apiBaseUrl, getAuthHeaders]);

  return { get, post, delete: del };
}

export function useCachedData<T>(
  endpoint: string | null,
  options: {
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

      const result = await get<T>(endpoint);
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
  }, [endpoint, get, data]);

  const mutate = useCallback((newData?: T) => {
    if (newData !== undefined) {
      setData(newData);
    } else {
      fetchData(false);
    }
  }, [fetchData]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    let intervalId: NodeJS.Timeout | null = null;
    if (options.refreshInterval && options.refreshInterval > 0) {
      intervalId = setInterval(() => fetchData(false), options.refreshInterval);
    }

    return () => {
      mountedRef.current = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [endpoint, options.refreshInterval, fetchData]);

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    refetch: () => fetchData(true),
  };
}

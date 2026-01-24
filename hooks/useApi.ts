import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useRef } from 'react';

export const useApi = () => {
  const { user } = useAuth();
  const apiBaseUrl = '/api/proxy';
  
  // Use ref to always have access to latest token without causing re-renders
  const tokenRef = useRef(user?.token);
  tokenRef.current = user?.token;

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = tokenRef.current;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (!token) {
      console.warn('[useApi] No authentication token available, request may fail');
      return headers;
    }

    headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, []);

  const handleResponse = useCallback(async (response: Response) => {
    if (!response.ok) {
      if (response.status === 401) {
        // Token might be expired, clear auth and redirect to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = '/auth';
        return null;
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
    }

    return response.json();
  }, []);

  const get = useCallback(async (url: string) => {
    const response = await fetch(`${apiBaseUrl}${url}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    return handleResponse(response);
  }, [apiBaseUrl, getAuthHeaders, handleResponse]);

  const post = useCallback(async (url: string, data: any) => {
    const response = await fetch(`${apiBaseUrl}${url}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return handleResponse(response);
  }, [apiBaseUrl, getAuthHeaders, handleResponse]);

  const put = useCallback(async (url: string, data: any) => {
    const response = await fetch(`${apiBaseUrl}${url}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return handleResponse(response);
  }, [apiBaseUrl, getAuthHeaders, handleResponse]);

  const del = useCallback(async (url: string) => {
    const response = await fetch(`${apiBaseUrl}${url}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    return handleResponse(response);
  }, [apiBaseUrl, getAuthHeaders, handleResponse]);

  return { get, post, put, delete: del };
};

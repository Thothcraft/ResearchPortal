import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useRef } from 'react';

export const useApi = () => {
  const { user } = useAuth();
  
  // Use ref to always have access to latest token without causing re-renders
  const tokenRef = useRef(user?.token);
  tokenRef.current = user?.token;

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

  const handleResponse = useCallback(async (response: Response) => {
    if (!response.ok) {
      if (response.status === 401) {
        // Token might be expired, clear auth and redirect to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = '/auth/login';
        return null;
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! Status: ${response.status}`);
    }

    return response.json();
  }, []);

  const get = useCallback(async (url: string) => {
    const response = await fetch(`https://web-production-d7d37.up.railway.app${url}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    return handleResponse(response);
  }, [getAuthHeaders, handleResponse]);

  const post = useCallback(async (url: string, data: any) => {
    const response = await fetch(`https://web-production-d7d37.up.railway.app${url}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });

    return handleResponse(response);
  }, [getAuthHeaders, handleResponse]);

  const put = useCallback(async (url: string, data: any) => {
    const response = await fetch(`https://web-production-d7d37.up.railway.app${url}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });

    return handleResponse(response);
  }, [getAuthHeaders, handleResponse]);

  const del = useCallback(async (url: string) => {
    const response = await fetch(`https://web-production-d7d37.up.railway.app${url}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    return handleResponse(response);
  }, [getAuthHeaders, handleResponse]);

  return { get, post, put, delete: del };
};

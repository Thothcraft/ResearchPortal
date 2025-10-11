import { useAuth } from '@/contexts/AuthContext';

export const useApi = () => {
  const { user } = useAuth();

  const getAuthHeaders = () => {
    if (!user?.token) {
      throw new Error('No authentication token available');
    }

    return {
      'Authorization': `Bearer ${user.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  };

  const handleResponse = async (response: Response) => {
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
  };

  const get = async (url: string) => {
    const response = await fetch(`https://web-production-d7d37.up.railway.app${url}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    return handleResponse(response);
  };

  const post = async (url: string, data: any) => {
    const response = await fetch(`https://web-production-d7d37.up.railway.app${url}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });

    return handleResponse(response);
  };

  const put = async (url: string, data: any) => {
    const response = await fetch(`https://web-production-d7d37.up.railway.app${url}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
      credentials: 'include',
    });

    return handleResponse(response);
  };

  const del = async (url: string) => {
    const response = await fetch(`https://web-production-d7d37.up.railway.app${url}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });

    return handleResponse(response);
  };

  return { get, post, put, delete: del };
};

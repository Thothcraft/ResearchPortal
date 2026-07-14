'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  username: string;
  token: string;
  role?: number;  // 0=user, 1=admin, 2=organization
  plan?: string;
  org_name?: string;
  userId?: number;
} | null;

type AuthContextType = {
  user: User;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decodeTokenPayload(token: string): Record<string, any> | null {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
}

function tokenIsExpired(token: string): boolean {
  const expires = Number(decodeTokenPayload(token)?.exp);
  return Number.isFinite(expires) && expires * 1000 <= Date.now();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const token = localStorage.getItem('auth_token');
      const userStr = localStorage.getItem('user');

      if (token && tokenIsExpired(token)) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      } else if (token && userStr) {
        try {
          const userData = JSON.parse(userStr);
          setUser({ ...userData, token });
        } catch (e) {
          console.error('Failed to parse user data:', e);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
        }
      } else if (token) {
        setUser({ username: 'user', token, role: 0 });
      } else {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setError(null);

    try {
      console.log('Attempting login with:', { username });
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      const response = await fetch('/api/proxy/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username,
          password
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));
      console.log('Login response:', { status: response.status, data });
      
      // Temporary workaround for production backend missing role field
      if (data.access_token && data.role == null) {
        // Try to decode JWT to get role
        try {
          const payload = decodeTokenPayload(data.access_token);
          if (payload) {
            data.role = payload.role;
            console.log('Extracted role from token:', data.role);
          }
        } catch (e) {
          console.warn('Could not extract role from token:', e);
          // Default to user role
          data.role = 0;
        }
      }

      if (!response.ok) {
        let errorMessage = 'Invalid username or password';
        if (data && typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (data && Array.isArray(data.detail)) {
          errorMessage = data.detail.map((err: any) => err.msg || JSON.stringify(err)).join(', ');
        } else if (data && data.message) {
          errorMessage = data.message;
        }
        setError(errorMessage);
        return false;
      }

      if (!data.access_token) {
        setError('No access token received');
        return false;
      }

      const userData = {
        username,
        token: data.access_token,
        role: data.role ?? 0,  // Default to user role if not provided
        plan: data.plan || null,
        org_name: data.org_name || null,
        userId: data.user_id,
      };

      console.log('User data prepared:', userData);

      // Store token and user data
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(userData));

      setUser(userData);
      
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.name === 'AbortError') {
        setError('Login request timed out. Please check your connection and try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      return false;
    }
  };

  const register = async (username: string, email: string, password: string): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Attempting registration with:', { username });

      const response = await fetch('/api/proxy/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username,
          email,
          password
        }),
      });

      const data = await response.json().catch(() => ({}));
      console.log('Registration response:', { status: response.status, data });

      if (!response.ok) {
        let errorMessage = 'Registration failed';
        if (data && typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (data && Array.isArray(data.detail)) {
          errorMessage = data.detail.map((err: any) => err.msg || JSON.stringify(err)).join(', ');
        } else if (data && data.message) {
          errorMessage = data.message;
        }
        setError(errorMessage);
        return { success: false, message: errorMessage };
      }

      return { success: true, message: data.message || 'Registration successful' };
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = 'An unexpected error occurred. Please try again.';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    navigator.serviceWorker?.ready.then((registration) => registration.active?.postMessage('CLEAR_PRIVATE_CACHE')).catch(() => undefined);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
    router.replace('/auth');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        isAuthenticated: !!user,
        isLoading,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Protected route component
export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

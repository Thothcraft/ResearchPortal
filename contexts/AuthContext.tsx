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
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Initialize auth state from localStorage
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } catch (e) {
        console.error('Failed to parse user data', e);
        localStorage.removeItem('auth_token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Attempting login with:', { username });
      
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
      });

      const data = await response.json().catch(() => ({}));
      console.log('Login response:', { status: response.status, data });
      
      // Temporary workaround for production backend missing role field
      if (data.access_token && !data.role) {
        // Try to decode JWT to get role
        try {
          const tokenParts = data.access_token.split('.');
          if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
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
        role: data.role || 0,  // Default to user role if not provided
        plan: data.plan || null,
        org_name: data.org_name || null,
        userId: data.user_id,
      };

      console.log('User data prepared:', userData);

      // Store token and user data
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setUser(userData);
      
      // Role-based redirect with a small delay to ensure state is updated
      console.log('Checking role for redirect:', data.role);
      setTimeout(() => {
        if (data.role === 1) {
          console.log('Redirecting to admin');
          router.push('/admin');
          // Fallback if router.push doesn't work
          setTimeout(() => {
            if (window.location.pathname !== '/admin') {
              window.location.href = '/admin';
            }
          }, 500);
        } else {
          console.log('Redirecting to home');
          router.push('/home');
          // Fallback if router.push doesn't work
          setTimeout(() => {
            if (window.location.pathname !== '/home') {
              window.location.href = '/home';
            }
          }, 500);
        }
      }, 100);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      setError('An unexpected error occurred. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/auth');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
};

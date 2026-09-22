'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  username: string;
  token: string;
  role?: number;  // 0=user, 1=admin
  plan?: string;
  userId?: number;
} | null;

type Entitlements = Record<string, any> | null;

type AuthContextType = {
  user: User;
  entitlements: Entitlements;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<{
    success: boolean;
    message: string;
    verificationRequired?: boolean;
    emailVerificationAvailable?: boolean;
  }>;
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
  const [entitlements, setEntitlements] = useState<Entitlements>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Fetch the plan entitlement set — drives gated UI (Labs, downloads).
  const refreshEntitlements = async () => {
    try {
      const res = await fetch('/api/proxy/account/entitlements', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setEntitlements(data.entitlements || null);
        if (data.plan) {
          setUser((u) => (u ? { ...u, plan: data.plan } : u));
        }
      }
    } catch {
      /* entitlements are best-effort; pages degrade gracefully */
    }
  };

  // Restore only a token whose account still exists. Long-lived JWTs from a
  // removed account must not trap the browser inside a broken protected shell.
  useEffect(() => {
    let active = true;
    const clearStoredAuth = () => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      if (active) setUser(null);
    };
    const restore = async () => {
      const token = localStorage.getItem('auth_token');
      const userStr = localStorage.getItem('user');
      if (!token || tokenIsExpired(token)) {
        clearStoredAuth();
        return;
      }
      try {
        const response = await fetch('/api/proxy/profile', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`Stored session rejected (${response.status})`);
        const profile = await response.json();
        const stored = userStr ? JSON.parse(userStr) : {};
        const restored = {
          ...stored,
          username: profile.username || stored.username,
          role: profile.role ?? stored.role ?? 0,
          plan: profile.plan ?? stored.plan,
          userId: profile.userId ?? profile.user_id ?? stored.userId,
          token,
        };
        localStorage.setItem('user', JSON.stringify(restored));
        if (active) setUser(restored);
        refreshEntitlements();
        return;
      } catch {
        // Stored bearer token failed — fall back to the HttpOnly
        // session cookie (the proxy forwards it to Brain).
      }
      try {
        const response = await fetch('/api/proxy/profile', {
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('No valid session');
        const profile = await response.json();
        const restored = {
          username: profile.username,
          role: profile.role ?? 0,
          plan: profile.plan,
          userId: profile.userId ?? profile.user_id,
          token: '',  // cookie session — no bearer token needed
        };
        localStorage.setItem('user', JSON.stringify(restored));
        if (active) setUser(restored);
        refreshEntitlements();
      } catch {
        clearStoredAuth();
      }
    };
    restore().finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setError(null);

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      const response = await fetch('/api/proxy/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));
      // Temporary workaround for production backend missing role field
      if (data.access_token && data.role == null) {
        // Try to decode JWT to get role
        try {
          const payload = decodeTokenPayload(data.access_token);
          if (payload) {
            data.role = payload.role;
          }
        } catch (e) {
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
        } else if (data && data.error) {
          errorMessage = data.error;
        }
        setError(errorMessage);
        return false;
      }

      if (!data.access_token) {
        setError('No access token received');
        return false;
      }

      const userData = {
        username: data.username || username.trim(),
        token: data.access_token,
        role: data.role ?? 0,  // Default to user role if not provided
        plan: data.plan || null,
        userId: data.user_id,
      };

      // Store token and user data. The login response also sets the
      // HttpOnly thoth_session cookie (forwarded by the proxy), which
      // becomes the session restore path going forward.
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(userData));

      setUser(userData);
      refreshEntitlements();

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

  const register = async (username: string, email: string, password: string): Promise<{
    success: boolean;
    message: string;
    verificationRequired?: boolean;
    emailVerificationAvailable?: boolean;
  }> => {
    setIsLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      const response = await fetch('/api/proxy/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim().toLowerCase(),
          password
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        let errorMessage = 'Registration failed';
        if (data && typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (data && Array.isArray(data.detail)) {
          errorMessage = data.detail.map((err: any) => err.msg || JSON.stringify(err)).join(', ');
        } else if (data && data.message) {
          errorMessage = data.message;
        } else if (data && data.error) {
          errorMessage = data.error;
        }
        setError(errorMessage);
        return { success: false, message: errorMessage };
      }

      return {
        success: true,
        message: data.message || 'Registration successful',
        verificationRequired: data.verification_required === true,
        emailVerificationAvailable: data.email_verification_available !== false,
      };
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMessage = error?.name === 'AbortError'
        ? 'Registration timed out while the server was waking up. Please try once more.'
        : 'An unexpected error occurred. Please try again.';
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    navigator.serviceWorker?.ready.then((registration) => registration.active?.postMessage('CLEAR_PRIVATE_CACHE')).catch(() => undefined);
    // Clear the HttpOnly session cookie server-side (best-effort).
    fetch('/api/proxy/logout', { method: 'POST', cache: 'no-store' }).catch(() => undefined);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
    setEntitlements(null);
    router.replace('/auth');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        entitlements,
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

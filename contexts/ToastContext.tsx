'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  details?: string[];
  hint?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
  // Convenience methods
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string, details?: { hint?: string; items?: string[] }) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_STYLES = {
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/50',
    icon: 'text-emerald-400',
    title: 'text-emerald-300',
    progress: 'bg-emerald-500',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/50',
    icon: 'text-red-400',
    title: 'text-red-300',
    progress: 'bg-red-500',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/50',
    icon: 'text-amber-400',
    title: 'text-amber-300',
    progress: 'bg-amber-500',
  },
  info: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/50',
    icon: 'text-blue-400',
    title: 'text-blue-300',
    progress: 'bg-blue-500',
  },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = toast.duration ?? 5000;
  const styles = TOAST_STYLES[toast.type];
  const Icon = TOAST_ICONS[toast.type];

  useEffect(() => {
    if (duration <= 0) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      
      if (remaining <= 0) {
        clearInterval(interval);
        handleClose();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onRemove, 300);
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg border shadow-lg backdrop-blur-sm
        ${styles.bg} ${styles.border}
        transform transition-all duration-300 ease-out
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
        animate-slide-in-right
      `}
      role="alert"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} />
          
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold ${styles.title}`}>{toast.title}</h4>
            
            {toast.message && (
              <p className="text-sm text-slate-300 mt-1">{toast.message}</p>
            )}
            
            {toast.details && toast.details.length > 0 && (
              <ul className="mt-2 text-sm text-slate-400 space-y-1">
                {toast.details.map((detail, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    {detail}
                  </li>
                ))}
              </ul>
            )}
            
            {toast.hint && (
              <p className="mt-2 text-xs text-slate-500 italic">
                💡 {toast.hint}
              </p>
            )}
            
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.onClick();
                  handleClose();
                }}
                className={`mt-3 text-sm font-medium ${styles.icon} hover:underline`}
              >
                {toast.action.label}
              </button>
            )}
          </div>
          
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1 -m-1"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700/50">
          <div
            className={`h-full ${styles.progress} transition-all duration-100 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const success = useCallback((title: string, message?: string) => {
    return addToast({ type: 'success', title, message, duration: 4000 });
  }, [addToast]);

  const error = useCallback((title: string, message?: string, details?: { hint?: string; items?: string[] }) => {
    return addToast({ 
      type: 'error', 
      title, 
      message, 
      hint: details?.hint,
      details: details?.items,
      duration: 8000 
    });
  }, [addToast]);

  const warning = useCallback((title: string, message?: string) => {
    return addToast({ type: 'warning', title, message, duration: 6000 });
  }, [addToast]);

  const info = useCallback((title: string, message?: string) => {
    return addToast({ type: 'info', title, message, duration: 5000 });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ 
      toasts, 
      addToast, 
      removeToast, 
      clearAllToasts,
      success,
      error,
      warning,
      info
    }}>
      {children}
      
      {/* Toast Container */}
      <div 
        className="fixed top-4 right-4 z-[100] flex flex-col gap-3 max-w-md w-full pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Helper to parse API error responses
export function parseApiError(error: any): { title: string; message?: string; hint?: string; items?: string[] } {
  // Handle structured API errors from Brain server
  if (error && typeof error === 'object') {
    // Check for our custom error format
    if (error.message && error.error_code) {
      return {
        title: error.message,
        hint: error.details?.hint,
        items: error.details?.datasets || error.details?.items,
      };
    }
    
    // Check for nested error in response
    if (error.detail) {
      if (typeof error.detail === 'string') {
        return { title: error.detail };
      }
      if (error.detail.message) {
        return {
          title: error.detail.message,
          hint: error.detail.details?.hint,
          items: error.detail.details?.datasets,
        };
      }
    }
  }
  
  // Fallback for string errors
  if (typeof error === 'string') {
    return { title: error };
  }
  
  // Default error
  return { title: error?.message || 'An unexpected error occurred' };
}

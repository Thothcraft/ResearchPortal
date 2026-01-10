/** Theme context for dark/light mode management */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  // Get system preference
  const getSystemTheme = (): 'dark' | 'light' => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  };

  // Apply theme to document
  const applyTheme = (themeToApply: 'dark' | 'light') => {
    const root = document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('dark', 'light');
    
    // Add new theme class
    root.classList.add(themeToApply);
    
    // Update meta theme-color for mobile browsers
    const themeColor = themeToApply === 'dark' ? '#0f172a' : '#ffffff';
    let metaThemeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta') as HTMLMetaElement;
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = themeColor;
    
    setResolvedTheme(themeToApply);
  };

  // Resolve theme based on preference
  const resolveTheme = (themePreference: Theme): 'dark' | 'light' => {
    if (themePreference === 'system') {
      return getSystemTheme();
    }
    return themePreference;
  };

  // Set theme and persist to localStorage
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    const resolved = resolveTheme(newTheme);
    applyTheme(resolved);
    
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
    }
  };

  // Toggle between dark and light
  const toggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      // If system, toggle to opposite of current resolved theme
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    }
  };

  // Initialize theme on mount
  useEffect(() => {
    // Get saved theme from localStorage
    const savedTheme = localStorage.getItem('theme') as Theme;
    const initialTheme = savedTheme || 'system';
    
    setThemeState(initialTheme);
    const resolved = resolveTheme(initialTheme);
    applyTheme(resolved);
    
    // Listen for system theme changes
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleSystemThemeChange = () => {
        if (theme === 'system') {
          applyTheme(getSystemTheme());
        }
      };
      
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      
      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }
  }, [theme]);

  const value: ThemeContextType = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Theme-aware CSS class names
export const themeClasses = {
  // Background colors
  bg: {
    dark: 'bg-slate-900',
    light: 'bg-white',
  },
  bgSecondary: {
    dark: 'bg-slate-800',
    light: 'bg-gray-50',
  },
  bgTertiary: {
    dark: 'bg-slate-700',
    light: 'bg-gray-100',
  },
  
  // Text colors
  text: {
    dark: 'text-white',
    light: 'text-gray-900',
  },
  textSecondary: {
    dark: 'text-slate-300',
    light: 'text-gray-600',
  },
  textMuted: {
    dark: 'text-slate-500',
    light: 'text-gray-500',
  },
  
  // Border colors
  border: {
    dark: 'border-slate-700',
    light: 'border-gray-200',
  },
  borderSecondary: {
    dark: 'border-slate-600',
    light: 'border-gray-300',
  },
  
  // Interactive elements
  hover: {
    dark: 'hover:bg-slate-700',
    light: 'hover:bg-gray-100',
  },
  active: {
    dark: 'bg-slate-700',
    light: 'bg-gray-100',
  },
  
  // Status colors (these remain the same but with proper contrast)
  success: {
    dark: 'text-green-400',
    light: 'text-green-600',
  },
  error: {
    dark: 'text-red-400',
    light: 'text-red-600',
  },
  warning: {
    dark: 'text-yellow-400',
    light: 'text-yellow-600',
  },
};

// Helper function to get theme-aware class
export function getThemeClass(
  classes: { dark: string; light: string },
  theme: 'dark' | 'light'
): string {
  return classes[theme];
}

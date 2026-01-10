/** Theme toggle component with dark/light/system options */

'use client';

import React, { useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const themes = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  const currentTheme = themes.find(t => t.value === theme) || themes[2];

  return (
    <div className="relative">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-slate-300"
        title="Change theme"
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="w-4 h-4" />
        ) : (
          <Sun className="w-4 h-4" />
        )}
        <span className="text-sm hidden sm:inline">{currentTheme.label}</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-20">
            <div className="p-2">
              {themes.map((themeOption) => {
                const Icon = themeOption.icon;
                const isActive = theme === themeOption.value;
                
                return (
                  <button
                    key={themeOption.value}
                    onClick={() => {
                      setTheme(themeOption.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-sm">{themeOption.label}</span>
                    {isActive && (
                      <div className="w-2 h-2 bg-indigo-400 rounded-full ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
            
            <div className="border-t border-slate-700 p-2">
              <div className="text-xs text-slate-500 px-3 py-1">
                Current: {resolvedTheme === 'dark' ? 'Dark' : 'Light'} mode
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Simple theme toggle button (for header)
export function SimpleThemeToggle() {
  const { theme, resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-slate-300"
      title={`Current: ${theme === 'system' ? `${resolvedTheme} (system)` : theme} - Click to toggle`}
    >
      {resolvedTheme === 'dark' ? (
        <Moon className="w-5 h-5" />
      ) : (
        <Sun className="w-5 h-5" />
      )}
    </button>
  );
}

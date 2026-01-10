/** Responsive layout with mobile-first design */

'use client';

import React, { useState } from 'react';
import { Menu, X, Home, Database, Cpu, FileText, Settings, Bell, User } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import SimpleThemeToggle from '@/components/ThemeToggle';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

export default function ResponsiveLayout({ children, currentPage = 'dashboard' }: ResponsiveLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home, current: currentPage === 'dashboard' },
    { name: 'Data', href: '/data', icon: Database, current: currentPage === 'data' },
    { name: 'Devices', href: '/devices', icon: Cpu, current: currentPage === 'devices' },
    { name: 'Models', href: '/models', icon: FileText, current: currentPage === 'models' },
    { name: 'Settings', href: '/settings', icon: Settings, current: currentPage === 'settings' },
  ];

  return (
    <div className={`min-h-screen ${resolvedTheme === 'dark' ? 'bg-slate-900' : 'bg-gray-50'}`}>
      {/* Mobile Header */}
      <div className="md:hidden">
        <div className="flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-white">ThothCraft</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors">
              <User className="w-5 h-5" />
            </button>
            <SimpleThemeToggle />
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-800 md:hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Navigation</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <nav className="p-4 space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      item.current
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{item.name}</span>
                  </a>
                );
              })}
            </nav>
          </div>
        </>
      )}

      {/* Desktop Layout */}
      <div className="hidden md:flex">
        {/* Desktop Sidebar */}
        <div className="w-64 bg-slate-800 border-r border-slate-700 min-h-screen">
          <div className="p-4 border-b border-slate-700">
            <h1 className="text-lg font-semibold text-white">ThothCraft</h1>
            <p className="text-xs text-slate-400 mt-1">Research Portal</p>
          </div>
          
          <nav className="p-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    item.current
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm font-medium">{item.name}</span>
                </a>
              );
            })}
          </nav>
        </div>

        {/* Desktop Header */}
        <div className="flex-1">
          <div className="bg-slate-800 border-b border-slate-700">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white capitalize">
                  {currentPage}
                </h2>
              </div>
              
              <div className="flex items-center gap-4">
                <button className="p-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors">
                  <Bell className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors">
                  <User className="w-5 h-5" />
                </button>
                <SimpleThemeToggle />
              </div>
            </div>
          </div>
          
          {/* Main Content */}
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Content */}
      <div className="md:hidden">
        <main className="p-4">
          {children}
        </main>
      </div>
    </div>
  );
}

// Mobile-friendly card component
export function MobileCard({ 
  children, 
  title, 
  subtitle,
  actions,
  className = '' 
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-slate-800 rounded-lg border border-slate-700 ${className}`}>
      {(title || subtitle || actions) && (
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              {title && <h3 className="text-white font-medium">{title}</h3>}
              {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

// Mobile-friendly button component
export function MobileButton({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  ...props
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  [key: string]: any;
}) {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500';
  
  const variantClasses = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-slate-700 hover:bg-slate-600 text-white',
    outline: 'border border-slate-600 hover:bg-slate-700 text-white',
  };
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current mr-2" />
      )}
      {children}
    </button>
  );
}

// Mobile-friendly input component
export function MobileInput({
  label,
  error,
  className = '',
  ...props
}: {
  label?: string;
  error?: string;
  className?: string;
  [key: string]: any;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <input
        className={`w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
          error ? 'border-red-500' : ''
        }`}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}

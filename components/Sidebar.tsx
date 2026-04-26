'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  Home,
  Monitor,
  Database,
  Brain,
  Settings,
  LogOut,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Workflow,
} from 'lucide-react';
import { useState } from 'react';
import ThemeSlider from './ThemeSlider';

const navItems = [
  { name: 'Home', href: '/home', icon: Home, description: 'Statistics & Overview' },
  { name: 'Devices', href: '/devices', icon: Monitor, description: 'Online/Offline Devices' },
  { name: 'Data', href: '/data', icon: Database, description: 'Data Files' },
  { name: 'Processing', href: '/processing', icon: Workflow, description: 'Data Pipelines' },
  { name: 'Training', href: '/training', icon: Brain, description: 'Model Training' },
  { name: 'Chatbot', href: '/chatbot', icon: MessageCircle, description: 'AI Assistant' },
  { name: 'Settings', href: '/settings', icon: Settings, description: 'Preferences' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen transition-all duration-300 flex flex-col',
        collapsed ? 'w-20' : 'w-64'
      )}
      style={{
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)'
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
        {!collapsed && (
          <Link href="/home" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <span className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>ThothCraft</span>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto" style={{ background: 'var(--accent)' }}>
            <span className="text-white font-bold text-sm">T</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {!collapsed && <ThemeSlider />}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-accent-dim)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                isActive ? 'text-white shadow-lg' : ''
              )}
              style={{
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? 'white' : 'var(--text-muted)',
                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-accent-dim)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }
              }}
            >
              <Icon className={cn('w-5 h-5 flex-shrink-0')} />
              {!collapsed && (
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span
                    className="text-xs"
                    style={{
                      color: isActive ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)'
                    }}
                  >
                    {item.description}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4" style={{ borderTop: '1px solid var(--border-color)' }}>
        {!collapsed && user && (
          <div className="mb-3 px-2">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user.username}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Researcher</p>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors',
            collapsed && 'justify-center'
          )}
          style={{ color: '#ef4444' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            e.currentTarget.style.color = '#f87171';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#ef4444';
          }}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

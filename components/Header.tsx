'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Home, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function Header() {
  const pathname = usePathname();
  const { logout } = useAuth();

  const navItems = [
    {
      name: 'Dashboard',
      href: '/home',
      icon: Home,
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
    },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/home" className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                ThothCraft
              </Link>
            </div>
            <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      isActive
                        ? 'border-indigo-500 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                      'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                    )}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <button
              onClick={logout}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;

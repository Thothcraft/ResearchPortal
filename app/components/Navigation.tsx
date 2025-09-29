'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, LogOut, Menu, X, Home, Database, Brain, Settings } from 'lucide-react';

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Get user info from localStorage
    const username = localStorage.getItem('username');
    const role = localStorage.getItem('user_role');
    if (username && role) {
      setUserInfo({ username, role });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('username');
    localStorage.removeItem('user_role');
    router.push('/auth');
  };

  const navItems = [
    { name: 'Dashboard', href: '/devices', icon: Home },
    { name: 'Data', href: '/data', icon: Database },
    { name: 'Training', href: '/training', icon: Brain },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <nav className="bg-black/20 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-white">Thoth Research</h1>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:ml-8 md:flex md:space-x-8">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.href}
                    className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </a>
                );
              })}
            </div>
          </div>

          {/* User Menu */}
          <div className="flex items-center">
            {userInfo && (
              <div className="hidden md:flex items-center space-x-4">
                <div className="text-sm">
                  <p className="text-white font-medium">{userInfo.username}</p>
                  <p className="text-gray-400 capitalize">{userInfo.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="text-gray-400 hover:text-white p-2"
              >
                {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden bg-black/40 backdrop-blur-md border-t border-white/10">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-gray-300 hover:text-white block px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center gap-2"
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </a>
              );
            })}
            
            {userInfo && (
              <div className="border-t border-white/10 pt-4 mt-4">
                <div className="px-3 py-2">
                  <p className="text-white font-medium">{userInfo.username}</p>
                  <p className="text-gray-400 capitalize text-sm">{userInfo.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left text-red-400 hover:text-red-300 px-3 py-2 rounded-md text-base font-medium transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

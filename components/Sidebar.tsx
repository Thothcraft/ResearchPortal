'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Monitor, LogOut, BookOpen, Shield, UserRound, Settings, ChevronUp, Boxes, Database, Map, BarChart3 } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user, entitlements } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const plan = user?.plan || 'free';
  const items = [
    { name: 'Home', href: '/home', icon: Home },
    { name: 'Devices', href: '/devices', icon: Monitor },
    { name: 'Spaces', href: '/spaces', icon: Map },
    { name: 'Data', href: '/captures', icon: Database },
    { name: 'Models', href: '/models', icon: Boxes },
    { name: 'Usage', href: '/usage', icon: BarChart3 },
    // Labs are a Research-plan entitlement, not an org feature.
    ...(entitlements?.labs || plan === 'research'
      ? [{ name: 'Labs', href: '/labs', icon: BookOpen }]
      : []),
    ...(user?.role === 1 ? [{ name: 'Admin', href: '/admin', icon: Shield }] : []),
  ];
  const signOut = async () => {
    const registration = await navigator.serviceWorker?.ready.catch(() => null);
    registration?.active?.postMessage('CLEAR_PRIVATE_CACHE');
    logout();
  };

  return <aside className="portal-sidebar">
    <Link href="/home" className="portal-brand"><span>T</span><strong>thothHUB</strong><small>Device cloud</small></Link>
    <nav>{items.map(({ name, href, icon: Icon }) => {
      const active = pathname === href || pathname?.startsWith(`${href}/`);
      return <Link key={href} href={href} className={active ? 'active' : ''}><Icon/><span>{name}</span></Link>;
    })}</nav>
    <div className="portal-account">
      <button type="button" onClick={() => setMoreOpen((value) => !value)} className="!mt-0 flex w-full items-center justify-between text-left">
        <div><p>{user?.username}</p><small>{user?.role === 1 ? 'Admin' : `${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`}</small></div>
        <ChevronUp className={`transition-transform ${moreOpen ? '' : 'rotate-180'}`} />
      </button>
      {moreOpen && <div className="mt-4 space-y-1 border-t border-[#353530] pt-3">
        <Link href="/profile" className="!px-0"><UserRound/><span>Profile</span></Link>
        <Link href="/settings" className="!px-0"><Settings/><span>Settings</span></Link>
        <button onClick={signOut}><LogOut/> Sign out</button>
      </div>}
    </div>
  </aside>;
}

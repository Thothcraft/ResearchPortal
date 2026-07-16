'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Monitor, LogOut, MessageCircle, Users, BookOpen, Shield, UserRound, Settings, ChevronUp } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = [
    { name: 'Home', href: '/home', icon: Home },
    { name: 'Devices', href: '/devices', icon: Monitor },
    { name: 'Assistant', href: '/chatbot', icon: MessageCircle },
    ...(user?.role === 1 ? [{ name: 'Admin', href: '/admin', icon: Shield }] : []),
    ...(user?.role === 2 ? [{ name: 'Members', href: '/members', icon: Users }, { name: 'Labs', href: '/labs', icon: BookOpen }] : []),
  ];
  const signOut = async () => {
    const registration = await navigator.serviceWorker?.ready.catch(() => null);
    registration?.active?.postMessage('CLEAR_PRIVATE_CACHE');
    logout();
  };

  return <aside className="portal-sidebar">
    <Link href="/home" className="portal-brand"><span>T</span><strong>Thoth</strong><small>Research portal</small></Link>
    <nav>{items.map(({ name, href, icon: Icon }) => {
      const active = pathname === href || pathname?.startsWith(`${href}/`);
      return <Link key={href} href={href} className={active ? 'active' : ''}><Icon/><span>{name}</span></Link>;
    })}</nav>
    <div className="portal-account">
      <button type="button" onClick={() => setMoreOpen((value) => !value)} className="!mt-0 flex w-full items-center justify-between text-left">
        <div><p>{user?.username}</p><small>{user?.role === 1 ? 'Admin' : user?.role === 2 ? 'Organization' : 'Researcher'}</small></div>
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

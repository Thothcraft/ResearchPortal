'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Home, Monitor, Settings, LogOut, MessageCircle, Users, BookOpen, Shield, UserRound } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const items = [
    { name: 'Overview', href: '/home', icon: Home },
    { name: 'Devices', href: '/devices', icon: Monitor },
    { name: 'Profile', href: '/profile', icon: UserRound },
    { name: 'Assistant', href: '/chatbot', icon: MessageCircle },
    ...(user?.role === 1 ? [{ name: 'Admin', href: '/admin', icon: Shield }] : []),
    ...(user?.role === 2 ? [{ name: 'Members', href: '/members', icon: Users }, { name: 'Labs', href: '/labs', icon: BookOpen }] : []),
    { name: 'Settings', href: '/settings', icon: Settings },
  ];
  const signOut = async () => { const registration = await navigator.serviceWorker?.ready.catch(() => null); registration?.active?.postMessage('CLEAR_PRIVATE_CACHE'); logout(); };

  return <aside className="portal-sidebar">
    <Link href="/home" className="portal-brand"><span>T</span><strong>Thoth</strong><small>Research portal</small></Link>
    <nav>{items.map(({ name, href, icon: Icon }) => { const active = pathname === href || pathname?.startsWith(`${href}/`); return <Link key={href} href={href} className={active ? 'active' : ''}><Icon/><span>{name}</span></Link>; })}</nav>
    <div className="portal-account"><p>{user?.username}</p><small>{user?.role === 1 ? 'Admin' : user?.role === 2 ? 'Organization' : 'Researcher'}</small><button onClick={signOut}><LogOut/> Sign out</button></div>
  </aside>;
}

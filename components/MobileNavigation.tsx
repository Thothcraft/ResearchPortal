'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Monitor, Settings, Activity } from 'lucide-react';

const items = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/devices', label: 'Devices', icon: Monitor },
  { href: '/data', label: 'Activity', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function MobileNavigation() {
  const pathname = usePathname();
  return <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur md:hidden">
    {items.map((item) => {
      const Icon = item.icon;
      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
      return <Link key={item.href} href={item.href} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold ${active ? 'bg-cyan-50 text-cyan-800' : 'text-slate-500'}`}>
        <Icon className="h-5 w-5" /><span>{item.label}</span>
      </Link>;
    })}
  </nav>;
}

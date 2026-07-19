'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Camera, Radar, Wifi, ShieldCheck } from 'lucide-react';

export default function PortalEntry() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (localStorage.getItem('auth_token')) router.replace('/home');
    else setReady(true);
  }, [router]);
  if (!ready) return <div className="min-h-screen bg-slate-950" />;

  const sensing = [
    { title: 'Localization', text: 'Presence and movement without identifiable imagery.', icon: Radar },
    { title: 'Wi‑Fi sensing', text: 'Passive environmental context from wireless signals.', icon: Wifi },
    { title: 'Optional camera', text: 'Visual context when your deployment calls for it.', icon: Camera },
  ];
  const uses = ['Smart home', 'Personal assistant productivity', 'Parental monitoring and control', 'Passive monitoring', 'Security'];

  return <main className="min-h-screen bg-slate-50 text-slate-950">
    <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
      <div className="flex items-center gap-2 font-semibold"><span className="rounded-lg bg-slate-950 px-2 py-1 text-white">T</span> thothHUB</div>
      <Link href="/auth" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Sign in</Link>
    </nav>
    <section className="mx-auto grid min-h-[68vh] max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.2fr_.8fr]">
      <div><div className="text-xs font-bold uppercase tracking-[.2em] text-cyan-700">Raspberry Pi ambient intelligence</div><h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[.95] tracking-[-.055em] sm:text-7xl">Understand a space through wireless sensing.</h1><p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">Thoth combines localization, Wi‑Fi sensing, and an optional camera in one local-first device for responsive, privacy-conscious environments.</p><Link href="/auth" className="mt-8 inline-flex rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950">Open thothHUB</Link></div>
      <div className="rounded-3xl bg-slate-950 p-7 text-white shadow-2xl"><ShieldCheck className="h-8 w-8 text-cyan-300"/><div className="mt-16 text-sm text-slate-400">Latest room state</div><div className="mt-1 text-4xl font-semibold">Occupied</div><div className="mt-8 grid grid-cols-3 gap-2 text-center text-xs">{sensing.map((item) => <div key={item.title} className="rounded-xl bg-white/10 px-2 py-3">{item.title}</div>)}</div></div>
    </section>
    <section className="mx-auto max-w-6xl px-5 py-16"><div className="grid gap-4 md:grid-cols-3">{sensing.map((item) => { const Icon=item.icon; return <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6"><Icon className="h-7 w-7 text-cyan-700"/><h2 className="mt-6 text-xl font-semibold">{item.title}</h2><p className="mt-2 leading-7 text-slate-600">{item.text}</p></article>; })}</div></section>
    <section className="mx-auto max-w-6xl px-5 pb-24"><h2 className="text-3xl font-semibold tracking-tight">Built for everyday spaces</h2><div className="mt-6 flex flex-wrap gap-3">{uses.map((use) => <span key={use} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium">{use}</span>)}</div></section>
  </main>;
}

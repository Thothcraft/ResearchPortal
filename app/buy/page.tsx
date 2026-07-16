'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

export default function BuyPage() {
  const { user } = useAuth();
  const { post } = useApi();
  const [error, setError] = useState('');
  const buy = async () => {
    try {
      const result = await post('/stripe/create-hardware-checkout-session', {});
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Hardware checkout is unavailable');
    }
  };

  return <main className="min-h-screen bg-[#f4f1e9] text-[#11110f]">
    <header className="flex items-center justify-between border-b border-[#aaa59b] px-5 py-5 sm:px-8"><Link href="/" className="text-lg font-semibold">Thoth</Link><div className="flex gap-5 text-sm font-semibold"><Link href="/pricing">Plans</Link><Link href={user ? '/home' : '/auth'}>{user ? 'Dashboard' : 'Sign in'}</Link></div></header>
    <section className="grid min-h-[78vh] lg:grid-cols-2">
      <div className="flex flex-col border-b border-[#aaa59b] p-6 sm:p-10 lg:border-b-0 lg:border-r"><div className="text-xs font-bold uppercase tracking-[.2em]">Thoth One / Indoor intelligence</div><h1 className="mt-16 text-[clamp(4.5rem,9vw,8.5rem)] font-semibold leading-[.82] tracking-[-.075em]">Presence,<br/>not surveillance.</h1><p className="mt-10 max-w-xl text-xl leading-8">A local-first mmWave radar and camera device for occupancy, normalized XY location, synchronized captures, and smart-room automation.</p><div className="mt-auto pt-14"><span className="text-6xl font-semibold tracking-[-.06em]">$500</span><span className="ml-3 text-sm uppercase tracking-[.12em]">USD / device</span></div></div>
      <div className="relative flex min-h-[620px] items-center justify-center overflow-hidden bg-[#c8d1b2] p-8"><div className="absolute h-[78%] w-[78%] rounded-full border border-[#687052]"/><div className="absolute h-[55%] w-[55%] rounded-full border border-[#687052]"/><div className="absolute h-[32%] w-[32%] rounded-full border border-[#687052]"/><div className="relative z-10 grid h-44 w-44 place-items-center rounded-[2rem] bg-[#11110f] text-center text-white shadow-2xl"><div><div className="text-4xl font-semibold">T</div><div className="mt-2 text-[10px] uppercase tracking-[.2em]">Radar + camera</div></div></div></div>
    </section>
    <section className="grid border-y border-[#aaa59b] md:grid-cols-4">{[['60 GHz radar','Spatial presence without wearables'],['Camera','Included for synchronized research capture'],['Local dashboard','Occupancy and XY maps stay available on LAN'],['Home Assistant','Room state for private automations']].map(([title, text], index) => <article key={title} className="min-h-64 border-b border-[#aaa59b] p-6 md:border-b-0 md:border-r"><span className="text-xs">0{index + 1}</span><h2 className="mt-16 text-2xl font-semibold">{title}</h2><p className="mt-3 text-sm leading-6 text-[#5b5953]">{text}</p></article>)}</section>
    <section className="grid gap-10 bg-[#11110f] px-6 py-20 text-white sm:px-10 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="text-xs font-bold uppercase tracking-[.2em] text-[#b9b4aa]">Secure checkout</div><h2 className="mt-8 max-w-4xl text-6xl font-semibold leading-[.9] tracking-[-.06em]">Build the first smart room.</h2><p className="mt-6 max-w-xl text-[#b9b4aa]">Stripe Checkout applies shipping, eligible destinations, tax and promotion codes. Portal plans remain separate.</p></div><div className="flex flex-col gap-3">
        {user ? <button onClick={buy} className="rounded-full bg-[#f4f1e9] px-7 py-4 font-semibold text-[#11110f]">Buy with Stripe</button> : <Link href="/auth" className="rounded-full bg-[#f4f1e9] px-7 py-4 text-center font-semibold text-[#11110f]">Create account to purchase</Link>}
        <Link href="/pricing" className="rounded-full border border-[#77736b] px-7 py-4 text-center font-semibold">Compare Portal plans</Link>
        {user?.plan && user.plan !== 'free' && <button onClick={async () => {
          try {
            const portal = await post('/stripe/billing-portal', {});
            window.location.assign(portal.url);
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Billing portal is unavailable');
          }
        }} className="rounded-full border border-[#77736b] px-7 py-4 font-semibold">Switch plan</button>}
      </div>
      {error && <p role="alert" className="text-red-300 lg:col-span-2">{error}</p>}
    </section>
  </main>;
}

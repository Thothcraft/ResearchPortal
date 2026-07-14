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
  return <main className="min-h-screen bg-slate-950 px-5 py-16 text-white"><section className="mx-auto max-w-3xl rounded-3xl border border-slate-700 bg-slate-900 p-8"><div className="text-sm font-semibold uppercase tracking-[.25em] text-cyan-300">Thoth hardware</div><h1 className="mt-3 text-4xl font-semibold">One radar presence device</h1><p className="mt-4 text-slate-300">Hardware is purchased separately from a Thoth subscription. Stripe Checkout shows the configured price, promotion-code field, automatic tax, available shipping rates, and destination eligibility.</p><div className="mt-8 flex flex-wrap gap-3">{user ? <button onClick={buy} className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950">Continue to secure checkout</button> : <Link href="/auth" className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950">Sign in to purchase</Link>}<Link href="/pricing" className="rounded-xl border border-slate-600 px-5 py-3 font-semibold">Compare subscriptions</Link></div>{error && <p role="alert" className="mt-5 text-red-300">{error}</p>}</section></main>;
}

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

const plans = [
  { id: 'free', title: 'Free', features: ['One device', 'Basic occupied / unoccupied status'] },
  { id: 'home', title: 'Home', features: ['Presence, maps, HAR and people count', 'Zones, labels, calibration and predictions'] },
  { id: 'pro', title: 'Pro', features: ['Everything in Home', 'Up to ten devices', 'Spaces and cross-room views'] },
  { id: 'research', title: 'Research', features: ['Everything in Pro', 'Detailed labels and packaged export', 'Academy and contextual assistant access'] },
] as const;

export default function PricingPage() {
  const { user } = useAuth();
  const { post } = useApi();
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [error, setError] = useState('');

  const checkout = async (plan: 'home' | 'pro' | 'research') => {
    try {
      if (user?.plan && user.plan !== 'free') {
        const portal = await post('/stripe/billing-portal', {});
        window.location.assign(portal.url);
        return;
      }
      const result = await post(`/stripe/create-checkout-session?plan=${plan}&billing_period=${period}`, {});
      window.location.assign(result.url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Checkout is unavailable');
    }
  };

  return <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
    <div className="mx-auto max-w-6xl">
      <div className="text-sm font-semibold uppercase tracking-[.25em] text-cyan-300">Thoth plans</div>
      <h1 className="mt-3 text-4xl font-semibold">Choose access separately from hardware</h1>
      <p className="mt-3 max-w-2xl text-slate-300">Prices, annual discounts, tax, and promotion codes are displayed by Stripe Checkout.</p>
      <div className="mt-8 inline-flex rounded-xl border border-slate-700 p-1">{(['monthly', 'annual'] as const).map((value) => <button key={value} onClick={() => setPeriod(value)} className={`rounded-lg px-5 py-2 capitalize ${period === value ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'}`}>{value}</button>)}</div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{plans.map((plan) => <section key={plan.id} className="flex flex-col rounded-2xl border border-slate-700 bg-slate-900 p-5"><h2 className="text-2xl font-semibold">{plan.title}</h2><div className="mt-2 text-sm text-slate-400">{plan.id === 'free' ? 'No payment required' : `Stripe ${period} price`}</div><ul className="my-6 flex-1 space-y-2 text-sm text-slate-200">{plan.features.map((feature) => <li key={feature}>• {feature}</li>)}</ul>{plan.id === 'free' ? <Link href={user ? '/home' : '/auth'} className="rounded-lg border border-slate-600 px-4 py-2 text-center font-semibold">{user ? 'Open dashboard' : 'Create account'}</Link> : user ? <button onClick={() => checkout(plan.id)} className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950">Continue to Stripe</button> : <Link href="/auth" className="rounded-lg bg-cyan-400 px-4 py-2 text-center font-semibold text-slate-950">Sign in to subscribe</Link>}</section>)}</div>
      <div className="mt-8"><Link href="/buy" className="font-semibold text-cyan-300">Buy Thoth hardware →</Link></div>
      {error && <p role="alert" className="mt-5 text-red-300">{error}</p>}
    </div>
  </main>;
}

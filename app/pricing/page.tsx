'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { type BillingPlan, type BillingPeriod } from '@/lib/billing';

const plans = [
  { id: 'free', title: 'Free', features: ['One device', 'Basic occupied / unoccupied status'] },
  { id: 'home', title: 'Home', features: ['Presence, maps, HAR and people count', 'Zones, labels, calibration and predictions'] },
  { id: 'pro', title: 'Pro', features: ['Everything in Home', 'Up to ten devices', 'Spaces and cross-room views'] },
  { id: 'research', title: 'Research', features: ['Everything in Pro', 'Detailed labels and packaged export', 'Academy and contextual assistant access'] },
] as const;

export default function PricingPage() {
  const { user } = useAuth();
  const { post } = useApi();
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [error, setError] = useState('');
  const [prices, setPrices] = useState<Record<string, { unit_amount: number; currency: string; interval?: string }>>({});

  useEffect(() => {
    fetch('/api/proxy/stripe/catalog')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Catalogue unavailable')))
      .then((data) => setPrices(data.prices || {}))
      .catch(() => setError('Live prices are temporarily unavailable. Stripe Checkout will show the final amount.'));
  }, []);

  const priceLabel = (plan: string) => {
    if (plan === 'free') return '$0';
    const price = prices[`${plan}_${period}`];
    if (!price) return 'Loading live price…';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: price.currency }).format(price.unit_amount / 100) + (price.interval ? ` / ${price.interval}` : '');
  };

  const checkout = async (plan: BillingPlan) => {
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
      <p className="mt-3 max-w-2xl text-slate-300">Hardware is $500 once. Home starts at $5/month, Pro at $10/month, and Research at $20/month. Tax and promotion codes are finalized by Stripe.</p>
      <div className="mt-8 inline-flex rounded-xl border border-slate-700 p-1">{(['monthly', 'annual'] as const).map((value) => <button key={value} onClick={() => setPeriod(value)} className={`rounded-lg px-5 py-2 capitalize ${period === value ? 'bg-cyan-400 text-slate-950' : 'text-slate-300'}`}>{value}</button>)}</div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{plans.map((plan) => <section key={plan.id} className="flex flex-col rounded-2xl border border-slate-700 bg-slate-900 p-5"><h2 className="text-2xl font-semibold">{plan.title}</h2><div className="mt-2 text-sm text-slate-400">{priceLabel(plan.id)}</div><ul className="my-6 flex-1 space-y-2 text-sm text-slate-200">{plan.features.map((feature) => <li key={feature}>• {feature}</li>)}</ul>{plan.id === 'free' ? <Link href={user ? '/home' : '/auth'} className="rounded-lg border border-slate-600 px-4 py-2 text-center font-semibold">{user ? 'Open dashboard' : 'Create account'}</Link> : user ? <button onClick={() => checkout(plan.id)} className="rounded-lg bg-cyan-400 px-4 py-2 font-semibold text-slate-950">{user.plan && user.plan !== 'free' ? 'Change plan in Stripe' : 'Choose plan'}</button> : <Link href="/auth" className="rounded-lg bg-cyan-400 px-4 py-2 text-center font-semibold text-slate-950">Create account to subscribe</Link>}</section>)}</div>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link href="/buy" className="font-semibold text-cyan-300">Buy Thoth hardware →</Link>
        {user?.plan && user.plan !== 'free' && <button onClick={async () => {
          try {
            const portal = await post('/stripe/billing-portal', {});
            window.location.assign(portal.url);
          } catch {
            setError('Billing portal is temporarily unavailable.');
          }
        }} className="font-semibold text-cyan-300">Switch plans in Stripe →</button>}
      </div>
      {error && <p role="alert" className="mt-5 text-red-300">{error}</p>}
    </div>
  </main>;
}

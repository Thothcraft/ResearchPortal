'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { type BillingPlan, type BillingPeriod } from '@/lib/billing';

const plans = [
  { id: 'free', title: 'Free', devices: '01 device', note: 'A complete local room.', features: ['Occupancy detection', 'Normalized XY location', 'Home Assistant integration', 'Data download and annotation'] },
  { id: 'home', title: 'Home', devices: '05 devices', note: 'A connected set of smart rooms.', features: ['Everything in Free', 'Multiple smart rooms', 'Remote Portal management', 'Unified capture timeline'] },
  { id: 'pro', title: 'Pro', devices: '10 devices', note: 'Private intelligence at the edge.', features: ['Everything in Home', 'Private AI detection models', 'Federated learning', 'Local training data'] },
  { id: 'research', title: 'Research', devices: '10 devices', note: 'The full research workflow.', features: ['Everything in Pro', 'Detailed labels and export', 'Research workspaces', 'Academy and assistant'] },
] as const;

export default function PricingPage() {
  const { user } = useAuth();
  const { post } = useApi();
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [error, setError] = useState('');
  const [prices, setPrices] = useState<Record<string, { unit_amount: number; currency: string; interval?: string }>>({});
  const annualAvailable = Object.keys(prices).some((key) => key.endsWith('_annual'));

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

  return <main className="min-h-screen bg-[#f4f1e9] text-[#11110f]">
    <header className="flex items-center justify-between border-b border-[#aaa59b] px-5 py-5 sm:px-8"><Link href="/" className="text-lg font-semibold">Thoth</Link><div className="flex gap-5 text-sm font-semibold"><Link href="/buy">Device</Link><Link href={user ? '/home' : '/auth'}>{user ? 'Dashboard' : 'Sign in'}</Link></div></header>
    <section className="grid min-h-[58vh] items-end gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1.35fr_.65fr]">
      <div><div className="text-xs font-bold uppercase tracking-[.2em]">Portal access / 2026</div><h1 className="mt-8 max-w-5xl text-[clamp(4.5rem,10vw,9rem)] font-semibold leading-[.82] tracking-[-.075em]">One room.<br/>Then many.</h1></div>
      <div className="pb-2 text-lg leading-7"><p>Start with full local occupancy and XY location. Pay only when multiple rooms, private models, or research workflows need one Portal.</p><p className="mt-6 text-sm text-[#666159]">The $500 Thoth device is purchased separately. Stripe calculates tax, shipping and promotions.</p></div>
    </section>
    <section className="border-y border-[#aaa59b] px-5 py-5 sm:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between"><span className="text-xs font-bold uppercase tracking-[.16em]">Billing cadence</span>{annualAvailable ? <div className="flex gap-1 rounded-full border border-[#8f8a81] p-1">{(['monthly', 'annual'] as const).map((value) => <button key={value} onClick={() => setPeriod(value)} className={`rounded-full px-5 py-2 text-sm capitalize ${period === value ? 'bg-[#11110f] text-white' : ''}`}>{value}</button>)}</div> : <span className="rounded-full border border-[#8f8a81] px-5 py-2 text-sm">Monthly billing</span>}</div></section>
    <section className="grid border-b border-[#aaa59b] lg:grid-cols-4">{plans.map((plan, index) => <article key={plan.id} className={`flex min-h-[560px] flex-col border-[#aaa59b] p-6 lg:border-r ${plan.id === 'home' ? 'bg-[#c8d1b2]' : ''}`}><div className="flex justify-between text-xs font-bold uppercase tracking-[.15em]"><span>0{index + 1}</span><span>{plan.devices}</span></div><h2 className="mt-16 text-5xl font-semibold tracking-[-.06em]">{plan.title}</h2><div className="mt-3 text-xl font-semibold">{priceLabel(plan.id)}</div><p className="mt-8 min-h-14 text-[#5b5953]">{plan.note}</p><ul className="mt-8 flex-1 border-t border-[#8f8a81] text-sm">{plan.features.map((feature) => <li key={feature} className="border-b border-[#aaa59b] py-3">{feature}</li>)}</ul>{plan.id === 'free' ? <Link href={user ? '/home' : '/auth'} className="mt-8 rounded-full border border-[#11110f] px-4 py-3 text-center font-semibold">{user ? 'Open dashboard' : 'Start free'}</Link> : user ? <button onClick={() => checkout(plan.id)} className="mt-8 rounded-full bg-[#11110f] px-4 py-3 font-semibold text-white">{user.plan && user.plan !== 'free' ? 'Manage in Stripe' : `Choose ${plan.title}`}</button> : <Link href="/auth" className="mt-8 rounded-full bg-[#11110f] px-4 py-3 text-center font-semibold text-white">Create account</Link>}</article>)}</section>
    <section className="grid gap-8 bg-[#11110f] px-5 py-20 text-[#f4f1e9] sm:px-8 lg:grid-cols-2"><div><div className="text-xs font-bold uppercase tracking-[.2em]">Hardware</div><h2 className="mt-7 text-6xl font-semibold leading-[.9] tracking-[-.06em]">Radar + camera.<br/>$500 once.</h2></div><div className="self-end"><p className="max-w-xl text-xl text-[#c7c2b9]">Every plan begins with the same local-first sensing device. A subscription changes scale and remote access, not core sensing.</p><Link href="/buy" className="mt-8 inline-block rounded-full bg-[#f4f1e9] px-6 py-3 font-semibold text-[#11110f]">See the Thoth device</Link>
        {user?.plan && user.plan !== 'free' && <button onClick={async () => {
          try {
            const portal = await post('/stripe/billing-portal', {});
            window.location.assign(portal.url);
          } catch {
            setError('Billing portal is temporarily unavailable.');
          }
        }} className="ml-4 font-semibold underline">Switch plans in Stripe</button>}{error && <p role="alert" className="mt-5 text-red-300">{error}</p>}</div></section>
  </main>;
}

import Link from 'next/link';

export default function CheckoutSuccessPage() {
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white"><section className="max-w-lg rounded-2xl border border-emerald-700 bg-slate-900 p-8 text-center"><h1 className="text-3xl font-semibold">Checkout received</h1><p className="mt-3 text-slate-300">Stripe is confirming the transaction. Subscription access and hardware fulfillment update from signed webhooks, not this redirect.</p><Link href="/home" className="mt-6 inline-block rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-slate-950">Return to dashboard</Link></section></main>;
}

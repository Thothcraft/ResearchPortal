import Link from 'next/link';

export default function CheckoutCancelPage() {
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white"><section className="max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center"><h1 className="text-3xl font-semibold">Checkout cancelled</h1><p className="mt-3 text-slate-300">Nothing was charged. You can return to pricing whenever you are ready.</p><Link href="/pricing" className="mt-6 inline-block rounded-lg bg-cyan-400 px-5 py-3 font-semibold text-slate-950">Back to pricing</Link></section></main>;
}

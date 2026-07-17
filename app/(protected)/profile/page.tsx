'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { BadgeCheck, Mail, Save, UserRound } from 'lucide-react';

type Profile = {
  userId: number;
  username: string;
  email?: string | null;
  email_verified: boolean;
  phone_number?: number | null;
  role: number;
  plan: string;
  org_name?: string | null;
};

export default function ProfilePage() {
  const { user } = useAuth();
  const { get, put, post } = useApi();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    get('/profile').then((value) => {
      setProfile(value);
      setUsername(value.username || '');
      setPhone(value.phone_number ? String(value.phone_number) : '');
      setOrganization(value.org_name || '');
    }).catch((error) => setStatus(error instanceof Error ? error.message : 'Unable to load profile'));
  }, [get]);

  const save = async () => {
    setStatus('Saving profile...');
    try {
      const updated = await put('/profile', {
        username,
        phone_number: phone ? Number(phone) : null,
        ...(profile?.role === 2 ? { org_name: organization } : {}),
      });
      setProfile(updated);
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, username: updated.username, org_name: updated.org_name }));
      setStatus('Profile saved.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save profile');
    }
  };

  const resend = async () => {
    if (!profile?.email) return;
    const result = await post('/resend-verification', { email: profile.email });
    setStatus(result.message || 'Verification email requested.');
  };

  if (!profile) return <div className="border border-slate-300 bg-white p-6 text-slate-700">{status || 'Loading profile...'}</div>;

  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="grid gap-6 border border-slate-300 bg-white p-6 md:grid-cols-[1fr_auto] md:items-end">
      <div><div className="text-xs font-semibold uppercase tracking-[.2em] text-slate-500">Account profile</div><h1 className="mt-2 text-4xl font-semibold text-slate-950">{profile.username}</h1><p className="mt-2 text-slate-600">Account #{profile.userId} · {profile.plan || 'free'} plan</p></div>
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-950 text-white"><UserRound className="h-9 w-9" /></div>
    </header>

    <section className="grid gap-6 md:grid-cols-[1.4fr_.6fr]">
      <div className="border border-slate-300 bg-white p-6">
        <h2 className="text-xl font-semibold">Identity</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Username<input value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 w-full border border-slate-400 bg-white px-3 py-2" /></label>
          <label className="text-sm font-medium">Phone<input inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))} className="mt-2 w-full border border-slate-400 bg-white px-3 py-2" placeholder="Optional" /></label>
          {profile.role === 2 && <label className="text-sm font-medium sm:col-span-2">Organization<input value={organization} onChange={(event) => setOrganization(event.target.value)} className="mt-2 w-full border border-slate-400 bg-white px-3 py-2" /></label>}
        </div>
        <button type="button" onClick={save} className="mt-6 inline-flex items-center gap-2 bg-slate-950 px-4 py-2 font-semibold text-white"><Save className="h-4 w-4" />Save profile</button>
        {status && <p className="mt-3 text-sm text-slate-600" role="status">{status}</p>}
      </div>

      <aside className="space-y-4">
        <div className="border border-slate-300 bg-white p-5"><Mail className="h-5 w-5" /><h2 className="mt-3 font-semibold">Email</h2><p className="mt-1 break-all text-sm text-slate-600">{profile.email || 'No email stored'}</p><p className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${profile.email_verified ? 'text-emerald-700' : 'text-amber-700'}`}><BadgeCheck className="h-4 w-4" />{profile.email_verified ? 'Verified' : 'Verification pending'}</p>{profile.email && !profile.email_verified && <button type="button" onClick={resend} className="mt-4 block text-sm font-semibold underline">Resend verification</button>}</div>
        <div className="border border-slate-300 bg-[#c8d1b2] p-5"><div className="text-xs font-semibold uppercase tracking-[.16em]">Plan</div><p className="mt-2 text-2xl font-semibold capitalize">{profile.plan || user?.plan || 'free'}</p><div className="mt-4 flex gap-3 text-sm font-semibold"><Link href="https://thothcraft.com/plans" className="underline">Compare plans</Link><Link href="https://thothcraft.com/product" className="underline">Buy device</Link></div></div>
      </aside>
    </section>
  </div>;
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthPage() {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { login, error, isAuthenticated } = useAuth();
  useEffect(() => { if (isAuthenticated) router.replace('/home'); }, [isAuthenticated, router]);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); if (!formData.username || !formData.password) return; setIsSubmitting(true); try { if (await login(formData.username, formData.password)) router.replace('/home'); } finally { setIsSubmitting(false); } };
  return <main className="auth-page">
    <header><Link href="/" className="portal-brand"><span>T</span><strong>Thoth</strong></Link><small>Research portal</small></header>
    <section><p className="editorial-label">PRIVATE WORKSPACE</p><h1>Welcome<br/>back.</h1><p className="auth-intro">Access devices, synchronized captures, datasets, and research tools.</p></section>
    <form onSubmit={submit}>
      <h2>Sign in</h2>{error && <p className="auth-error">{typeof error === 'string' ? error : 'Unable to sign in'}</p>}
      <label htmlFor="username">Username</label><input id="username" autoComplete="username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}/>
      <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}/>
      <button disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Continue'}</button>
    </form>
  </main>;
}

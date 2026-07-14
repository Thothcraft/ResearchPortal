'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthPage() {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { login, register, error, isAuthenticated } = useAuth();
  useEffect(() => { if (isAuthenticated) router.replace('/home'); }, [isAuthenticated, router]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password || (mode === 'register' && !formData.email)) return;
    setIsSubmitting(true); setNotice('');
    try {
      if (mode === 'signin') {
        if (await login(formData.username, formData.password)) router.replace('/home');
      } else {
        const result = await register(formData.username, formData.email, formData.password);
        if (result.success) { setNotice(result.message); setMode('signin'); }
      }
    } finally { setIsSubmitting(false); }
  };
  return <main className="auth-page">
    <header><Link href="/" className="portal-brand"><span>T</span><strong>Thoth</strong></Link><small>Research portal</small></header>
    <section><p className="editorial-label">PRIVATE WORKSPACE</p><h1>Welcome<br/>back.</h1><p className="auth-intro">Access devices, synchronized captures, datasets, and research tools.</p></section>
    <form onSubmit={submit}>
      <h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>{error && <p className="auth-error">{typeof error === 'string' ? error : 'Unable to continue'}</p>}{notice && <p className="auth-notice">{notice}</p>}
      <label htmlFor="username">Username</label><input id="username" autoComplete="username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}/>
      {mode === 'register' && <><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}/></>}
      <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}/>
      <button disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : mode === 'signin' ? 'Continue' : 'Register and verify email'}</button>
      <button type="button" style={{ marginTop: 12, background: 'transparent', color: '#4d4a44', border: '1px solid #c9c4b9' }} onClick={() => { setMode(mode === 'signin' ? 'register' : 'signin'); setNotice(''); }}>{mode === 'signin' ? 'New here? Create an account' : 'Already registered? Sign in'}</button>
    </form>
  </main>;
}

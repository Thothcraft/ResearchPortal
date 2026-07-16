'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthPage() {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [notice, setNotice] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [registrationConfigured, setRegistrationConfigured] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { login, register, error, isAuthenticated } = useAuth();
  useEffect(() => {
    if (isAuthenticated) router.replace('/home');
    else if (new URLSearchParams(window.location.search).get('verified') === '1') setNotice('Email verified. Sign in to continue.');
  }, [isAuthenticated, router]);
  useEffect(() => {
    fetch('/api/proxy/registration-status').then((response) => response.json()).then((value) => setRegistrationConfigured(value.email_registration_configured === true && value.email_verification_check_configured === true)).catch(() => undefined);
  }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password || (mode === 'register' && !formData.email)) return;
    setIsSubmitting(true); setNotice('');
    try {
      if (mode === 'signin') {
        if (await login(formData.username, formData.password)) router.replace('/home');
      } else {
        const result = await register(formData.username, formData.email, formData.password);
        if (result.success) {
          setNotice(result.message || 'Check your inbox for the verification email before signing in.');
          setPendingEmail(formData.email);
          setMode('signin');
        }
      }
    } finally { setIsSubmitting(false); }
  };
  const resendVerification = async () => {
    if (!pendingEmail) return;
    const response = await fetch('/api/proxy/resend-verification', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: pendingEmail }) });
    const data = await response.json().catch(() => ({}));
    setNotice(response.ok ? data.message : (data.detail || 'Unable to resend verification email.'));
  };
  return <main className="auth-page">
    <header><Link href="/" className="portal-brand"><span>T</span><strong>Thoth</strong></Link><small>Research portal</small></header>
    <section><p className="editorial-label">PRIVATE WORKSPACE</p><h1>Welcome<br/>back.</h1><p className="auth-intro">Access devices, synchronized captures, datasets, and research tools.</p></section>
    <form onSubmit={submit}>
      <h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>{error && <p className="auth-error">{typeof error === 'string' ? error : 'Unable to continue'}</p>}{notice && <p className="auth-notice">{notice}</p>}
      {!registrationConfigured && mode === 'register' && <p className="auth-error">Email registration is temporarily unavailable while the verification provider is being configured.</p>}
      <label htmlFor="username">Username</label><input id="username" autoComplete="username" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}/>
      {mode === 'register' && <><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}/></>}
      <label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}/>
      <button disabled={isSubmitting || (mode === 'register' && !registrationConfigured)}>{isSubmitting ? 'Please wait…' : mode === 'signin' ? 'Continue' : 'Register and verify email'}</button>
      <button type="button" style={{ marginTop: 12, background: 'transparent', color: '#4d4a44', border: '1px solid #c9c4b9' }} onClick={() => { setMode(mode === 'signin' ? 'register' : 'signin'); setNotice(''); }}>{mode === 'signin' ? 'New here? Create an account' : 'Already registered? Sign in'}</button>
      {pendingEmail && mode === 'signin' && <button type="button" style={{ marginTop: 12, background: 'transparent', color: '#4d4a44', border: '1px solid #c9c4b9' }} onClick={resendVerification}>Resend verification email</button>}
      {mode === 'register' && <p className="mt-4 text-sm text-slate-500">We will send a verification email after signup. Do not sign in until the email link has been confirmed.</p>}
    </form>
  </main>;
}

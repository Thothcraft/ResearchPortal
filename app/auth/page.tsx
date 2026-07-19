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
  const [registrationAvailable, setRegistrationAvailable] = useState<boolean | null>(null);
  const [emailVerificationAvailable, setEmailVerificationAvailable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { login, register, error, isAuthenticated } = useAuth();
  useEffect(() => {
    if (isAuthenticated) router.replace('/home');
    else if (new URLSearchParams(window.location.search).get('verified') === '1') setNotice('Email verified. Sign in to continue.');
  }, [isAuthenticated, router]);
  useEffect(() => {
    fetch('/api/proxy/registration-status')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Registration status returned ${response.status}`);
        return response.json();
      })
      .then((value) => {
        const providerReady = value.email_registration_configured === true && value.email_verification_check_configured === true;
        setEmailVerificationAvailable(providerReady);
        setRegistrationAvailable(value.account_registration_available === true || providerReady);
      })
      .catch(() => setRegistrationAvailable(false));
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
          setPendingEmail(result.verificationRequired ? formData.email : '');
          if (result.emailVerificationAvailable === false) setEmailVerificationAvailable(false);
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
    <section><p className="editorial-label">PRIVATE WORKSPACE</p><h1>{mode === 'signin' ? <>Welcome<br/>back.</> : <>Begin<br/>here.</>}</h1><p className="auth-intro">One account for your portal, devices, captures, and research tools.</p></section>
    <form onSubmit={submit}>
      <h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>{error && <p className="auth-error">{typeof error === 'string' ? error : 'Unable to continue'}</p>}{notice && <p className="auth-notice">{notice}</p>}
      {registrationAvailable === false && mode === 'register' && <p className="auth-error">Account registration is temporarily unavailable. Please try again shortly.</p>}
      {registrationAvailable && !emailVerificationAvailable && mode === 'register' && <p className="auth-notice">Email verification is temporarily unavailable. You can still create an account and sign in with your username.</p>}
      <label htmlFor="username">{mode === 'signin' ? 'Username or verified email' : 'Username'}</label><input id="username" autoComplete="username" placeholder={mode === 'signin' ? 'you@example.com' : 'Choose a username'} value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })}/>
      {mode === 'register' && <><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}/></>}
      <label htmlFor="password">Password</label><input id="password" type="password" minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}/>
      <div className="auth-actions"><button className="auth-primary" disabled={isSubmitting || (mode === 'register' && registrationAvailable !== true)}>{isSubmitting ? 'Please wait…' : mode === 'signin' ? 'Continue' : emailVerificationAvailable ? 'Register and verify email' : 'Create account'}</button>
      <button type="button" className="auth-secondary" onClick={() => { setMode(mode === 'signin' ? 'register' : 'signin'); setNotice(''); }}>{mode === 'signin' ? 'New here? Create an account' : 'Already registered? Sign in'}</button>
      {pendingEmail && mode === 'signin' && <button type="button" className="auth-secondary" onClick={resendVerification}>Resend verification email</button>}</div>
      {mode === 'register' && <p className="auth-help">{emailVerificationAvailable ? 'We will email a secure verification link. Confirm it before signing in here or on a Thoth device.' : 'Use your username to sign in until email verification is restored.'}</p>}
    </form>
  </main>;
}

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getBillingPlanTitle } from '@/lib/billing';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { useApi } from '@/hooks/useApi';
import {
  User,
  Bell,
  Shield,
  Palette,
  Database,
  Key,
  Save,
  Check,
  Languages,
  CreditCard,
  Crown,
  Zap,
} from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, localeLabels } = useI18n();
  const [saved, setSaved] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [billingError, setBillingError] = useState('');
  const [billingLoading, setBillingLoading] = useState('');
  const { post } = useApi();
  const [settings, setSettings] = useState({
    notifications: {
      email: true,
      push: false,
      deviceAlerts: true,
    },
    privacy: {
      shareData: false,
      analytics: true,
    },
    appearance: {
      theme: theme,
      compactMode: false,
    },
    data: {
      autoSync: true,
      retentionDays: 30,
    },
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateSetting = (category: string, key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...(prev as any)[category],
        [key]: value,
      },
    }));
  };

  const openCheckout = async (plan: 'home' | 'pro' | 'research') => {
    if (user?.plan && user.plan !== 'free') {
      await openBillingPortal();
      return;
    }
    setBillingLoading(plan);
    setBillingError('');
    try {
      const response = await post(`/stripe/create-checkout-session?plan=${plan}&billing_period=${billingPeriod}`, {});
      if (!response?.url) throw new Error('Stripe did not return a Checkout URL');
      window.location.assign(response.url);
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Unable to open Stripe Checkout');
      setBillingLoading('');
    }
  };

  const openBillingPortal = async () => {
    setBillingLoading('portal');
    setBillingError('');
    try {
      const response = await post('/stripe/billing-portal', {});
      if (!response?.url) throw new Error('Stripe did not return a portal URL');
      window.location.assign(response.url);
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : 'Unable to open billing portal');
      setBillingLoading('');
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-slate-400">Manage your account and preferences</p>
      </div>

      {/* Profile Section */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-semibold text-white">Profile</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Username</label>
            <input
              type="text"
              value={user?.username || ''}
              disabled
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">Email</label>
            <input
              type="email"
              placeholder="user@example.com"
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-semibold text-white">Notifications</h2>
        </div>
        <div className="space-y-4">
          {[
            { key: 'email', label: 'Email Notifications', desc: 'Receive updates via email' },
            { key: 'push', label: 'Push Notifications', desc: 'Browser push notifications' },
            { key: 'deviceAlerts', label: 'Device Alerts', desc: 'Get notified when devices go offline' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-white font-medium">{item.label}</p>
                <p className="text-slate-500 text-sm">{item.desc}</p>
              </div>
              <button
                onClick={() =>
                  updateSetting('notifications', item.key, !(settings.notifications as any)[item.key])
                }
                className={`w-12 h-6 rounded-full transition-colors ${
                  (settings.notifications as any)[item.key] ? 'bg-indigo-600' : 'bg-slate-600'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full transition-transform ${
                    (settings.notifications as any)[item.key] ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Appearance Section */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Palette className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-semibold text-white">Appearance</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white font-medium">Theme</p>
              <p className="text-slate-500 text-sm">Choose your preferred color scheme</p>
            </div>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
              className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white font-medium">Language</p>
              <p className="text-slate-500 text-sm">Select your preferred language</p>
            </div>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as any)}
              className="px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            >
              {Object.entries(localeLabels).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Privacy Section */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-semibold text-white">Privacy & Security</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white font-medium">Share Usage Data</p>
              <p className="text-slate-500 text-sm">Help improve the platform</p>
            </div>
            <button
              onClick={() => updateSetting('privacy', 'shareData', !settings.privacy.shareData)}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.privacy.shareData ? 'bg-indigo-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.privacy.shareData ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white font-medium">Analytics</p>
              <p className="text-slate-500 text-sm">Allow anonymous usage analytics</p>
            </div>
            <button
              onClick={() => updateSetting('privacy', 'analytics', !settings.privacy.analytics)}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.privacy.analytics ? 'bg-indigo-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.privacy.analytics ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-slate-700">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition-colors">
            <Key className="w-4 h-4" />
            Change Password
          </button>
        </div>
      </div>

      {/* Data Management Section */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Database className="w-5 h-5 text-indigo-400" />
          <h2 className="text-xl font-semibold text-white">Data Management</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-white font-medium">Auto Sync</p>
              <p className="text-slate-500 text-sm">Automatically sync data from devices</p>
            </div>
            <button
              onClick={() => updateSetting('data', 'autoSync', !settings.data.autoSync)}
              className={`w-12 h-6 rounded-full transition-colors ${
                settings.data.autoSync ? 'bg-indigo-600' : 'bg-slate-600'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  settings.data.autoSync ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
          <div>
            <label className="block text-white font-medium mb-2">Data Retention (days)</label>
            <select
              value={settings.data.retentionDays}
              onChange={(e) => updateSetting('data', 'retentionDays', parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
              <option value={365}>1 year</option>
            </select>
          </div>
        </div>
      </div>

      {/* Subscription Plan */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Crown className="w-5 h-5 text-yellow-400" />
          <h2 className="text-xl font-semibold text-white">Subscription Plan</h2>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <div>
              <h3 className="text-lg font-medium text-white capitalize">{getBillingPlanTitle(user?.plan || 'free')}</h3>
              <p className="text-sm text-slate-400">Billing state is synchronized from signed Stripe webhooks.</p>
            </div>
          </div>
          <div className="flex gap-2 rounded-lg bg-slate-900/50 p-1">
            {(['monthly', 'annual'] as const).map((period) => <button key={period} type="button" onClick={() => setBillingPeriod(period)} className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold capitalize ${billingPeriod === period ? 'bg-indigo-600 text-white' : 'text-slate-300'}`}>{period}</button>)}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {(['home', 'pro', 'research'] as const).map((plan) => (
              <button key={plan} type="button" disabled={Boolean(billingLoading)} onClick={() => openCheckout(plan)} className="rounded-lg border border-indigo-500 bg-indigo-700 p-4 text-left text-white transition hover:bg-indigo-600 disabled:opacity-60">
                {plan === 'research' ? <Crown className="mb-2 h-5 w-5" /> : <Zap className="mb-2 h-5 w-5" />}
                <h4 className="font-semibold capitalize">{billingLoading === plan ? 'Opening…' : plan}</h4>
                <p className="mt-1 text-xs opacity-80">{user?.plan && user.plan !== 'free' ? 'Manage or switch this plan in Stripe.' : 'Price and applicable discount shown securely by Stripe.'}</p>
              </button>
            ))}
          </div>
          {user?.plan !== 'free' && (
            <button type="button" onClick={openBillingPortal} disabled={Boolean(billingLoading)} className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
              <CreditCard className="w-4 h-4" />
              {billingLoading === 'portal' ? 'Opening…' : 'Manage or switch plan in Stripe'}
            </button>
          )}
          {billingError && <p role="alert" className="text-sm font-semibold text-red-400">{billingError}</p>}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            saved
              ? 'bg-green-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {saved ? (
            <>
              <Check className="w-5 h-5" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

'use client';
import { useI18n } from '@/contexts/I18nContext';
import { Languages } from 'lucide-react';

export function LanguageSelector() {
  const { locale, setLocale, localeLabels } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <Languages className="w-4 h-4 text-slate-400" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as any)}
        className="bg-transparent text-sm text-slate-300 border-none focus:ring-0 cursor-pointer"
      >
        {Object.entries(localeLabels).map(([code, label]) => (
          <option key={code} value={code} className="bg-slate-900 text-white">
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

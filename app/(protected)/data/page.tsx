'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DataRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/devices');
  }, [router]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
      Opening devices...
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PortalEntry() {
  const router = useRouter();

  useEffect(() => {
    router.replace(localStorage.getItem('auth_token') ? '/home' : '/auth');
  }, [router]);

  return <main className="min-h-screen bg-[#f4f1e9]" aria-label="Opening Thoth Portal" />;
}

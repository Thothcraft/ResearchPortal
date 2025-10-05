'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

export default function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/auth');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="pt-16">
        {children}
      </main>
    </div>
  );
}

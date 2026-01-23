'use client';

import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ChatBubble from './components/ChatBubble';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
        <ChatBubble />
      </ToastProvider>
    </AuthProvider>
  );
}

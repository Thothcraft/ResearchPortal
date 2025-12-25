'use client';

import { AuthProvider } from './contexts/AuthContext';
import ChatBubble from './components/ChatBubble';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <ChatBubble />
    </AuthProvider>
  );
}

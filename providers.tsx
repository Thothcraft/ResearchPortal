'use client';

import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ChatBubble from './components/ChatBubble';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          {children}
          <ChatBubble />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

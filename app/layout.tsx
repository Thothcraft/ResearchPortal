import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "../providers";
import ThemeCat from "../components/ThemeCat";
import { I18nProvider } from "@/contexts/I18nContext";

const inter = Inter({
  subsets: ["latin"],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "ThothCraft Research Portal",
  description: "IoT Device Management and Research Platform",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <I18nProvider>
          <Providers>
            {children}
            <ThemeCat />
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}

// src/app/layout.tsx
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { LocationProvider } from '@/context/LocationContext';
import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agri X - Platform Hasil Pertanian Indonesia',
  description: 'Jual dan beli hasil pertanian langsung dari petani',
  keywords: ['pertanian', 'petani', 'hasil bumi', 'e-commerce', 'indonesia'],
  authors: [{ name: 'Agri X Team' }],
  openGraph: {
    title: 'Agri X - Platform Hasil Pertanian Indonesia',
    description: 'Jual dan beli hasil pertanian langsung dari petani',
    type: 'website',
    locale: 'id_ID',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      {/* ✅ Tidak ada <head> tag dengan script */}
      <body className="antialiased min-h-screen bg-background text-text-primary" suppressHydrationWarning={true}>
        
        {/* ✅ App Providers */}
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="light"
          enableSystem={false}
          storageKey="agri-x-theme"
        >
          <AuthProvider>
            <CartProvider>
              <LocationProvider>
                {children}
              </LocationProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>

        {/* ✅ Toaster */}
        <Toaster 
          position="bottom-right"
          containerStyle={{
            zIndex: 9999,
            bottom: 24,
            right: 24,
          }}
          reverseOrder={false}
          gutter={12}
          toastOptions={{
            duration: 3000,
            style: {
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              backdropFilter: 'blur(8px)',
            },
            success: {
              duration: 3000,
              iconTheme: { primary: '#10B981', secondary: '#fff' },
              style: { borderLeft: '4px solid #10B981' },
            },
            error: {
              duration: 5000,
              iconTheme: { primary: '#EF4444', secondary: '#fff' },
              style: { borderLeft: '4px solid #EF4444' },
            },
            loading: {
              duration: Infinity,
              iconTheme: { primary: '#3B82F6', secondary: '#fff' },
              style: { borderLeft: '4px solid #3B82F6' },
            },
            blank: {
              duration: 4000,
              style: { borderLeft: '4px solid #6B7280' },
            },
          }}
        />

      </body>
    </html>
  );
}
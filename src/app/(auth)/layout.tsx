import { ThemeProvider } from 'next-themes';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agri X - Auth',
  description: 'Halaman autentikasi Agri X',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      storageKey="agri-x-theme"
    >
      {children}
    </ThemeProvider>
  );
}
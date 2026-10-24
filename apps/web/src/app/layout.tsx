import type { Metadata, Viewport } from 'next';
import { ProvedorSessao } from '@/components/sessao';
import './globals.css';

export const metadata: Metadata = {
  title: 'Makários · Eleição',
  description: 'Sistema de votação para presidente do Motoclube Makários',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2B1D17' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <ProvedorSessao>{children}</ProvedorSessao>
      </body>
    </html>
  );
}

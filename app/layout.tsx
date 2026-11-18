import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '@/components/ui';
import './globals.css';

export const metadata: Metadata = {
  title: 'SEVENT X — Platform Agregasi Lowongan & Pemetaan Karier Indonesia',
  description:
    'Platform agregasi lowongan kerja Indonesia lintas bidang dan tingkat pengalaman dengan pemetaan kecocokan profil yang jujur serta studio persiapan CV (SDG 8: Decent Work and Economic Growth).',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,800&family=JetBrains+Mono:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="app-shell">
          <SiteHeader />
          <main id="main-content" className="app-main" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}

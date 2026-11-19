import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SITE_NAME, SiteFooter, SiteHeader } from '@/components/ui';
import './globals.css';

export const metadata: Metadata = {
  title: `${SITE_NAME} — Cari Lowongan Kerja & Cek Kecocokan Profil`,
  description:
    'Cari lowongan kerja lintas bidang di Indonesia, lihat kecocokan kualifikasi profilmu secara transparan, siapkan CV, lalu lamar langsung di situs resmi perusahaan.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" data-type="software" data-radius="soft" data-buttons="solid">
      <head>
        <meta name="page-type" content="software" />
        <meta name="site-kind" content="software" />
        <meta name="theme-color" content="#ffffff" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Sans:wdth,wght@75..100,400..700&display=swap"
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

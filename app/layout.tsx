import type { Metadata } from 'next';
import { Instrument_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { SITE_NAME } from '@/components/ui/api-client';
import { SiteFooter, SiteHeader } from '@/components/ui/navigation';
import './globals.css';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-instrument-sans',
});

export const metadata: Metadata = {
  title: `${SITE_NAME} — Cari Lowongan Kerja & Cek Kecocokan Profil`,
  description:
    'Cari lowongan kerja lintas bidang di Indonesia, lihat kecocokan kualifikasi profilmu secara transparan, siapkan CV, lalu lamar langsung di situs resmi perusahaan.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="id"
      data-type="software"
      data-radius="soft"
      data-buttons="solid"
      className={instrumentSans.variable}
    >
      <head>
        <meta name="page-type" content="software" />
        <meta name="site-kind" content="software" />
        <meta name="theme-color" content="#ffffff" />
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

import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'SEVENT X API',
  description: 'Backend API platform lowongan SEVENT X.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          background: '#f7f7f8',
          color: '#18181b',
        }}
      >
        {children}
      </body>
    </html>
  );
}

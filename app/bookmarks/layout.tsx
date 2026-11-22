import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Lowongan Tersimpan',
};

export default function BookmarksLayout({ children }: { children: ReactNode }) {
  return children;
}

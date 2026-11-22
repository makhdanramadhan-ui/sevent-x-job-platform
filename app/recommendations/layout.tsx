import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Rekomendasi Lowongan',
};

export default function RecommendationsLayout({ children }: { children: ReactNode }) {
  return children;
}

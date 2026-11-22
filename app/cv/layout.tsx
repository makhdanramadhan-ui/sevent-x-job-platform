import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Studio CV',
};

export default function CvLayout({ children }: { children: ReactNode }) {
  return children;
}

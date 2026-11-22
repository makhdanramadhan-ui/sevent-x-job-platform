import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Editor CV',
};

export default function CvEditorLayout({ children }: { children: ReactNode }) {
  return children;
}

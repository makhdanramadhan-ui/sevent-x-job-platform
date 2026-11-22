import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Lupa Kata Sandi',
};

export default function ForgotPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}

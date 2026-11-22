import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Pengaturan Akun',
};

export default function AccountSettingsLayout({ children }: { children: ReactNode }) {
  return children;
}

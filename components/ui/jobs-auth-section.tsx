'use client';

import dynamic from 'next/dynamic';
import { AuthGuard } from './auth-guard';
import { LoadingState } from './feedback';

const JobsFeedClient = dynamic(() => import('./jobs-feed-client'), {
  ssr: false,
  loading: () => (
    <LoadingState
      title="Mengambil daftar lowongan..."
      description="Memuat data lowongan terbaru untukmu."
      lines={5}
      reserved
    />
  ),
});

export function JobsAuthSection() {
  return (
    <AuthGuard title="Masuk untuk Membuka Feed Lowongan">
      {() => <JobsFeedClient />}
    </AuthGuard>
  );
}

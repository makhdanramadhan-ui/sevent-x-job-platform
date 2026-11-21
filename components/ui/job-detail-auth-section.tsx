'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { prefetchJobDetail } from '@/lib/job-detail-prefetch';
import { AuthGuard } from './auth-guard';
import { LoadingState } from './feedback';
import { hasAuthSessionCookie } from './navigation';

const JobDetailClient = dynamic(() => import('./job-detail-client'), {
  ssr: false,
  loading: () => (
    <LoadingState
      title="Memuat detail lowongan & sumber asli..."
      description="Mengambil informasi lengkap lowongan beserta riwayat job_sources."
      lines={5}
      reserved
    />
  ),
});

export function JobDetailAuthSection() {
  const params = useParams<{ id: string }>();
  const jobId = typeof params?.id === 'string' ? params.id : '';

  useEffect(() => {
    if (!jobId || !hasAuthSessionCookie()) return;
    // Mulai ambil data detail lowongan secara paralel bersama /api/auth/me
    void prefetchJobDetail(jobId);
  }, [jobId]);

  return (
    <AuthGuard title="Masuk untuk Melihat Detail & Sumber Lowongan" headingAs="h1">
      {() => <JobDetailClient />}
    </AuthGuard>
  );
}

'use client';

import dynamic from 'next/dynamic';

const JobDetailGuestFallback = dynamic(() => import('./job-detail-guest-fallback'), {
  ssr: false,
});

export function JobDetailAuthSection() {
  return <JobDetailGuestFallback />;
}

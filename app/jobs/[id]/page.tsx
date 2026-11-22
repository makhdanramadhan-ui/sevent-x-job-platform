import type { Metadata } from 'next';
import { JobDetailAuthSection } from '@/components/ui/job-detail-auth-section';

export const metadata: Metadata = {
  title: 'Detail Lowongan',
};

export default function JobDetailPage() {
  return (
    <div style={{ minHeight: '78vh' }}>
      <JobDetailAuthSection />
    </div>
  );
}

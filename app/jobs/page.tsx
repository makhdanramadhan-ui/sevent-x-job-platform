import Link from 'next/link';
import { JobsAuthSection } from '@/components/ui/jobs-auth-section';
import { PageBanner } from '@/components/ui/page-banner';

export default function JobsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageBanner
        kicker="Eksplorasi Karier"
        title="Cari Lowongan Kerja"
        subtitle="Temukan peluang kerja yang sesuai dengan bidang, lokasi, dan sistem kerja pilihanmu."
        tone="sky"
        imageSrc="/images/banner-jobs.jpg"
        actions={
          <>
            <Link
              href="/recommendations"
              prefetch={false}
              className="btn btn-secondary btn-sm"
            >
              Cek Kecocokan Profil
            </Link>
            <Link
              href="/bookmarks"
              prefetch={false}
              className="btn btn-outline btn-sm"
            >
              Lowongan Tersimpan
            </Link>
          </>
        }
      />

      <JobsAuthSection />
    </div>
  );
}

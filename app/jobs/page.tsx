import type { Metadata } from 'next';
import Link from 'next/link';
import { ButtonText } from '@/components/ui/button-text';
import { JobsAuthSection } from '@/components/ui/jobs-auth-section';
import { PageBanner } from '@/components/ui/page-banner';

export const metadata: Metadata = {
  title: 'Cari Lowongan Kerja',
};

export default function JobsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageBanner
        kicker="Eksplorasi Karier"
        title="Cari Lowongan Kerja"
        subtitle="Temukan peluang kerja yang sesuai dengan bidang, lokasi, dan sistem kerja pilihanmu."
        tone="sky"
        imageSrc="/images/banner-jobs-vector.svg"
        actions={
          <>
            <Link
              href="/recommendations"
              prefetch={false}
              className="btn btn-secondary btn-sm"
            >
              <ButtonText>Cek Kecocokan Profil</ButtonText>
            </Link>
            <Link
              href="/bookmarks"
              prefetch={false}
              className="btn btn-outline btn-sm"
            >
              <ButtonText>Lowongan Tersimpan</ButtonText>
            </Link>
            <Link
              href="/profile?next=/jobs"
              prefetch={false}
              className="btn btn-outline btn-sm"
            >
              <ButtonText>Perbarui Profil</ButtonText>
            </Link>
          </>
        }
      />

      <JobsAuthSection />
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useAuthSession } from './navigation';

export function HomeHeroAuthCta() {
  const { session, loading } = useAuthSession();

  if (loading) {
    return <span className="btn btn-outline btn-lg home-hero-auth-cta auth-cta-placeholder" aria-hidden="true" />;
  }

  if (!session) {
    return (
      <Link href="/signup" className="btn btn-outline btn-lg home-hero-auth-cta">
        Daftar Akun
      </Link>
    );
  }

  return session.has_profile ? (
    <Link href="/recommendations" className="btn btn-outline btn-lg home-hero-auth-cta">
      Lihat Rekomendasi
    </Link>
  ) : (
    <Link href="/onboarding" className="btn btn-outline btn-lg home-hero-auth-cta">
      Lengkapi Profil
    </Link>
  );
}

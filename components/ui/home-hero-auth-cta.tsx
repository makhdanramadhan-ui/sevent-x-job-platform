'use client';

import Link from 'next/link';
import { ButtonText } from './button-text';
import { useAuthSession } from './navigation';

export function HomeHeroAuthCta() {
  const { session, loading } = useAuthSession();

  if (loading) {
    return <span className="btn btn-outline btn-lg home-hero-auth-cta auth-cta-placeholder" aria-hidden="true" />;
  }

  if (!session) {
    return (
      <Link href="/signup" className="btn btn-outline btn-lg home-hero-auth-cta">
        <ButtonText>Daftar Akun</ButtonText>
      </Link>
    );
  }

  return session.has_profile ? (
    <Link href="/recommendations" className="btn btn-outline btn-lg home-hero-auth-cta">
      <ButtonText>Lihat Rekomendasi</ButtonText>
    </Link>
  ) : (
    <Link href="/onboarding" className="btn btn-outline btn-lg home-hero-auth-cta">
      <ButtonText>Lengkapi Profil</ButtonText>
    </Link>
  );
}

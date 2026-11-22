import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ButtonText } from '@/components/ui/button-text';

export const metadata: Metadata = {
  title: 'Halaman Tidak Ditemukan',
};

export default function NotFound() {
  return (
    <section className="not-found-page" aria-labelledby="not-found-title">
      <Image
        src="/images/not-found-vector.svg"
        alt="Ilustrasi vektor seseorang memegang peta mencari halaman yang tidak ditemukan"
        width={300}
        height={240}
        unoptimized
        priority
        className="not-found-image"
      />
      <p className="not-found-code">404</p>
      <h1 id="not-found-title" className="not-found-title">
        Halaman Tidak Ditemukan
      </h1>
      <p className="not-found-text">
        Halaman yang kamu cari tidak tersedia, sudah dipindahkan, atau masih dalam pengembangan.
      </p>
      <div className="not-found-actions">
        <Link href="/" className="btn btn-primary">
          <ButtonText>Kembali ke Beranda</ButtonText>
        </Link>
        <Link href="/jobs" className="btn btn-outline">
          <ButtonText>Cari Lowongan</ButtonText>
        </Link>
      </div>
    </section>
  );
}

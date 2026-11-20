import Image from 'next/image';
import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="not-found-page" aria-labelledby="not-found-title">
      <Image
        src="/images/not-found-3d.jpg"
        alt="Ilustrasi 3D orang kebingungan"
        width={320}
        height={320}
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
          Kembali ke Beranda
        </Link>
        <Link href="/jobs" className="btn btn-outline">
          Cari Lowongan
        </Link>
      </div>
    </section>
  );
}

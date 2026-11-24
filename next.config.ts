import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Cegah clickjacking: halaman tidak boleh dimuat di dalam iframe situs lain.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Isolasi jendela dari situs lain (cegah tabnabbing lewat window.opener).
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          // Browser tidak boleh menebak tipe file di luar Content-Type yang dikirim.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // CSP sengaja belum dipasang; menunggu peninjauan.
        ],
      },
    ];
  },
};

export default nextConfig;

const ROUTES = [
  { method: 'POST', path: '/api/auth/signup', note: 'Pendaftaran akun Supabase Auth' },
  { method: 'POST', path: '/api/auth/login', note: 'Login sesi cookie atau Bearer' },
  { method: 'POST', path: '/api/auth/logout', note: 'Mengakhiri sesi aktif' },
  { method: 'GET', path: '/api/auth/me', note: 'Identitas sesi terverifikasi' },
  { method: 'GET, PUT, DELETE', path: '/api/profile', note: 'Profil milik pengguna' },
  { method: 'GET', path: '/api/jobs', note: 'Daftar lowongan dengan filter dan paginasi' },
  { method: 'GET', path: '/api/jobs/[id]', note: 'Detail lowongan dan sumbernya' },
  { method: 'GET, POST', path: '/api/bookmarks', note: 'Lowongan tersimpan milik pengguna' },
  { method: 'DELETE', path: '/api/bookmarks/[jobId]', note: 'Menghapus lowongan tersimpan' },
  { method: 'GET, POST', path: '/api/cv', note: 'Dokumen CV terstruktur milik pengguna' },
  { method: 'GET, PUT, DELETE', path: '/api/cv/[id]', note: 'Satu dokumen CV milik pengguna' },
] as const;

export default function Home() {
  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: '64px 24px' }}>
      <h1 style={{ fontSize: 32, margin: '0 0 8px' }}>SEVENT X — Backend API</h1>
      <p style={{ lineHeight: 1.6, color: '#3f3f46', margin: '0 0 32px' }}>
        Permukaan data platform lowongan SEVENT X. Antarmuka pengguna dikerjakan Anggota 1.
        Semua endpoint lowongan, profil, bookmark, dan CV memerlukan sesi terautentikasi.
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {ROUTES.map((route) => (
          <li
            key={route.path}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'baseline',
              background: '#ffffff',
              border: '1px solid #e4e4e7',
              borderRadius: 8,
              padding: '12px 16px',
            }}
          >
            <code style={{ fontSize: 13, color: '#52525b', minWidth: 140 }}>{route.method}</code>
            <code style={{ fontSize: 14, fontWeight: 600 }}>{route.path}</code>
            <span style={{ fontSize: 14, color: '#52525b' }}>{route.note}</span>
          </li>
        ))}
      </ul>
      <p style={{ marginTop: 32, fontSize: 14, color: '#52525b', lineHeight: 1.6 }}>
        Kontrak request/response, batas keamanan, dan kontrak integrasi anggota 3 serta anggota 4
        tercatat di README repositori.
      </p>
    </main>
  );
}

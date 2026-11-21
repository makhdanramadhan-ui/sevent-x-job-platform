export function HomeHeroVisual() {
  return (
    <div
      className="tk-hero-scene"
      aria-label="Ilustrasi avatar pencari kerja RakitKarier dengan indikator kecocokan profil, lowongan aktif, CV ATS, dan keahlian"
    >
      {/* Lapisan latar & aksen geometris bergerak */}
      <div className="tk-hero-scene__grid" aria-hidden="true" />

      <div className="tk-hero-scene__orbit" aria-hidden="true">
        <span className="tk-hero-orbit-dot tk-hero-orbit-dot--1" />
        <span className="tk-hero-orbit-dot tk-hero-orbit-dot--2" />
      </div>

      <span className="tk-hero-spark tk-hero-spark--1" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4L12 2Z" />
        </svg>
      </span>
      <span className="tk-hero-spark tk-hero-spark--2" aria-hidden="true" />
      <span className="tk-hero-spark tk-hero-spark--3" aria-hidden="true" />

      {/* Avatar Vektor Utama */}
      <div className="tk-hero-avatar-stage">
        <div className="tk-hero-avatar-halo" aria-hidden="true" />
        <div className="tk-hero-avatar-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-avatar-vector.svg"
            alt="Avatar ilustrasi profesional muda pencari kerja di RakitKarier"
            width={220}
            height={220}
            decoding="async"
            fetchPriority="high"
            className="tk-hero-avatar-img"
          />
        </div>
        <span className="tk-hero-avatar-check" aria-hidden="true">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      </div>

      {/* 4 Aset Kartu Mengambang di Sudut */}
      <div className="tk-hero-float tk-hero-float--match" aria-hidden="true">
        <div className="tk-hero-float__row">
          <span className="tk-hero-float__icon tk-hero-float__icon--green">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </span>
          <div className="tk-hero-float__copy">
            <strong className="tk-hero-float__title">92% Cocok</strong>
            <span className="tk-hero-float__sub">Profil &amp; Lowongan</span>
          </div>
        </div>
        <div className="tk-hero-mini-bar">
          <span className="tk-hero-mini-bar__fill" />
        </div>
      </div>

      <div className="tk-hero-float tk-hero-float--job" aria-hidden="true">
        <div className="tk-hero-float__row">
          <span className="tk-hero-float__icon tk-hero-float__icon--blue">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </span>
          <div className="tk-hero-float__copy">
            <strong className="tk-hero-float__title">Lowongan Aktif</strong>
            <span className="tk-hero-float__sub">Sumber Resmi</span>
          </div>
        </div>
      </div>

      <div className="tk-hero-float tk-hero-float--cv" aria-hidden="true">
        <div className="tk-hero-float__row">
          <span className="tk-hero-float__icon tk-hero-float__icon--indigo">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </span>
          <div className="tk-hero-float__copy">
            <strong className="tk-hero-float__title">CV ATS Siap</strong>
            <span className="tk-hero-float__sub">Format A4 PDF</span>
          </div>
        </div>
      </div>

      <div className="tk-hero-float tk-hero-float--skills" aria-hidden="true">
        <div className="tk-hero-float__skills-head">
          <span className="tk-hero-float__bolt">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </span>
          <strong className="tk-hero-float__title">Keahlian</strong>
        </div>
        <div className="tk-hero-skill-pills">
          <span>UI/UX</span>
          <span>React</span>
          <span className="tk-hero-skill-pill--accent">+4</span>
        </div>
      </div>
    </div>
  );
}

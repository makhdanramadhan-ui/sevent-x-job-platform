import type { ReactNode } from 'react';

/**
 * Koleksi Ilustrasi Editorial RakitKarier (Anti-AI-Slop Custom Vector Art)
 * Dirancang khusus dengan palet kertas hangat (#F6F4EF), tinta karbon (#171715),
 * terracotta (#B84221), dan zamrud (#1B5E43).
 */

export function HeroCareerIllustration() {
  return (
    <figure
      className="editorial-figure"
      style={{
        margin: 0,
        background: '#ECE8DE',
        border: '1.5px solid #171715',
        borderRadius: '6px',
        padding: '12px',
        boxShadow: '3px 3px 0px #171715',
      }}
    >
      <svg
        viewBox="0 0 680 340"
        width="100%"
        height="auto"
        role="img"
        aria-labelledby="hero-illus-title hero-illus-desc"
        style={{ display: 'block', borderRadius: '4px', background: '#FDFCF9' }}
      >
        <title id="hero-illus-title">
          Ilustrasi Ekosistem Pencarian Kerja dan Pemetaan Profil RakitKarier
        </title>
        <desc id="hero-illus-desc">
          Visualisasi kandidat profesional Indonesia yang memetakan profil dan CV terhadap lowongan
          kerja dari berbagai bidang industri.
        </desc>

        {/* Background Architectural Grid */}
        <defs>
          <pattern id="editorial-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="#E5E0D3"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="680" height="340" fill="url(#editorial-grid)" />

        {/* Decorative Warm Sun / Nusantara Horizon Circle */}
        <circle cx="540" cy="88" r="56" fill="#FAEAE5" stroke="#B84221" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="540" cy="88" r="34" fill="#F3D0C5" />

        {/* Left Card: Candidate Profile & CV Blueprint */}
        <g transform="translate(26, 32)">
          <rect x="4" y="4" width="196" height="268" rx="6" fill="#171715" />
          <rect
            x="0"
            y="0"
            width="196"
            height="268"
            rx="6"
            fill="#FDFCF9"
            stroke="#171715"
            strokeWidth="2"
          />
          {/* Top Header Bar of Profile Card */}
          <rect
            x="0"
            y="0"
            width="196"
            height="34"
            rx="6"
            fill="#171715"
          />
          <circle cx="16" cy="17" r="4.5" fill="#B84221" />
          <circle cx="29" cy="17" r="4.5" fill="#ECE8DE" />
          <text
            x="44"
            y="21"
            fontFamily="monospace"
            fontSize="10"
            fontWeight="700"
            fill="#FDFCF9"
          >
            PROFIL &amp; STUDIO CV
          </text>

          {/* Stylized Candidate Avatar Portrait */}
          <rect
            x="16"
            y="48"
            width="54"
            height="58"
            rx="4"
            fill="#FAEAE5"
            stroke="#171715"
            strokeWidth="1.5"
          />
          {/* Head & Shoulders Silhouette */}
          <circle cx="43" cy="68" r="11" fill="#B84221" stroke="#171715" strokeWidth="1.5" />
          <path
            d="M25 102 C25 88, 61 88, 61 102 Z"
            fill="#171715"
          />

          {/* Candidate Name & Headline Bars */}
          <rect x="80" y="52" width="96" height="10" rx="2" fill="#171715" />
          <rect x="80" y="68" width="74" height="7" rx="2" fill="#6B685F" />
          <rect x="80" y="82" width="60" height="16" rx="3" fill="#E7F3ED" stroke="#1B5E43" strokeWidth="1" />
          <text x="86" y="93" fontFamily="monospace" fontSize="8.5" fontWeight="700" fill="#1B5E43">
            SIAP MELAMAR
          </text>

          {/* Skills Chips inside Profile Card */}
          <text x="16" y="126" fontFamily="monospace" fontSize="9" fontWeight="700" fill="#6B685F">
            KEAHLIAN &amp; PENGALAMAN
          </text>
          <rect x="16" y="134" width="58" height="18" rx="3" fill="#ECE8DE" stroke="#171715" strokeWidth="1.2" />
          <text x="23" y="146" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#171715">
            TypeScript
          </text>
          <rect x="80" y="134" width="46" height="18" rx="3" fill="#ECE8DE" stroke="#171715" strokeWidth="1.2" />
          <text x="88" y="146" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#171715">
            Analitik
          </text>
          <rect x="132" y="134" width="48" height="18" rx="3" fill="#ECE8DE" stroke="#171715" strokeWidth="1.2" />
          <text x="140" y="146" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#171715">
            Desain
          </text>

          {/* Timeline Experience Lines */}
          <line x1="24" y1="168" x2="24" y2="232" stroke="#171715" strokeWidth="1.5" />
          <circle cx="24" cy="174" r="4" fill="#B84221" stroke="#171715" strokeWidth="1.2" />
          <rect x="36" y="169" width="110" height="8" rx="2" fill="#171715" />
          <rect x="36" y="181" width="84" height="6" rx="2" fill="#8C887E" />

          <circle cx="24" cy="204" r="4" fill="#FDFCF9" stroke="#171715" strokeWidth="1.5" />
          <rect x="36" y="199" width="98" height="8" rx="2" fill="#171715" />
          <rect x="36" y="211" width="76" height="6" rx="2" fill="#8C887E" />

          <circle cx="24" cy="230" r="4" fill="#FDFCF9" stroke="#171715" strokeWidth="1.5" />
          <rect x="36" y="225" width="120" height="8" rx="2" fill="#171715" />

          {/* Bottom CV Export Tag */}
          <rect x="16" y="242" width="164" height="16" rx="3" fill="#F6F4EF" stroke="#D6D1C4" strokeWidth="1" />
          <text x="26" y="253" fontFamily="monospace" fontSize="8.5" fontWeight="600" fill="#3F3D37">
            ✓ CV Terstruktur &amp; Impor PDF
          </text>
        </g>

        {/* Center Bridge: Matching Engine Nodes & Connecting Lines */}
        <g>
          {/* Dashed Connector Paths */}
          <path
            d="M 226 115 C 268 115, 272 145, 306 145"
            fill="none"
            stroke="#171715"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
          <path
            d="M 226 195 C 268 195, 272 175, 306 175"
            fill="none"
            stroke="#B84221"
            strokeWidth="2"
          />
          <path
            d="M 412 145 C 442 145, 446 105, 476 105"
            fill="none"
            stroke="#1B5E43"
            strokeWidth="2"
          />
          <path
            d="M 412 175 C 442 175, 446 218, 476 218"
            fill="none"
            stroke="#171715"
            strokeWidth="2"
            strokeDasharray="5 4"
          />

          {/* Center Matching Hub Box */}
          <rect x="303" y="113" width="114" height="98" rx="8" fill="#171715" />
          <rect
            x="299"
            y="109"
            width="114"
            height="98"
            rx="8"
            fill="#FDFCF9"
            stroke="#171715"
            strokeWidth="2"
          />
          <rect x="311" y="120" width="90" height="16" rx="3" fill="#B84221" />
          <text x="321" y="131" fontFamily="monospace" fontSize="9" fontWeight="700" fill="#FDFCF9">
            PEMETAAN JUJUR
          </text>

          {/* 3 Match Indicators */}
          <rect x="311" y="143" width="90" height="15" rx="3" fill="#E7F3ED" stroke="#1B5E43" strokeWidth="1" />
          <text x="317" y="154" fontFamily="monospace" fontSize="8.5" fontWeight="700" fill="#1B5E43">
            ✓ 5 Alasan Cocok
          </text>

          <rect x="311" y="162" width="90" height="15" rx="3" fill="#FBF1E4" stroke="#8F5112" strokeWidth="1" />
          <text x="317" y="173" fontFamily="monospace" fontSize="8.5" fontWeight="700" fill="#8F5112">
            ! 1 Syarat Kurang
          </text>

          <rect x="311" y="181" width="90" height="15" rx="3" fill="#EBE7DD" stroke="#6B685F" strokeWidth="1" />
          <text x="317" y="192" fontFamily="monospace" fontSize="8.5" fontWeight="700" fill="#4F4D46">
            ? 0 Tak Diketahui
          </text>
        </g>

        {/* Right Column: Aggregated Original Job Cards */}
        <g transform="translate(476, 36)">
          {/* Top Job Card (Primary Match) */}
          <rect x="4" y="4" width="176" height="122" rx="6" fill="#171715" />
          <rect
            x="0"
            y="0"
            width="176"
            height="122"
            rx="6"
            fill="#FDFCF9"
            stroke="#171715"
            strokeWidth="2"
          />
          <rect x="12" y="12" width="64" height="15" rx="3" fill="#E7F3ED" stroke="#1B5E43" strokeWidth="1" />
          <text x="18" y="23" fontFamily="monospace" fontSize="8" fontWeight="700" fill="#1B5E43">
            MASIH DIBUKA
          </text>
          <text x="84" y="23" fontFamily="monospace" fontSize="8" fill="#6B685F">
            Diambil hari ini
          </text>

          <text x="12" y="44" fontFamily="Georgia, serif" fontSize="13" fontWeight="700" fill="#171715">
            Software Engineer
          </text>
          <text x="12" y="60" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill="#3F3D37">
            Jakarta · Hybrid · Full-time
          </text>

          <rect x="12" y="82" width="152" height="26" rx="4" fill="#B84221" stroke="#171715" strokeWidth="1.5" />
          <text x="24" y="99" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#FDFCF9">
            Buka Sumber Asli ↗
          </text>
        </g>

        <g transform="translate(476, 178)">
          {/* Bottom Job Card (Cross-Industry) */}
          <rect x="4" y="4" width="176" height="118" rx="6" fill="#171715" />
          <rect
            x="0"
            y="0"
            width="176"
            height="118"
            rx="6"
            fill="#FDFCF9"
            stroke="#171715"
            strokeWidth="2"
          />
          <rect x="12" y="12" width="64" height="15" rx="3" fill="#E7F3ED" stroke="#1B5E43" strokeWidth="1" />
          <text x="18" y="23" fontFamily="monospace" fontSize="8" fontWeight="700" fill="#1B5E43">
            MASIH DIBUKA
          </text>
          <text x="84" y="23" fontFamily="monospace" fontSize="8" fill="#6B685F">
            Sumber Resmi
          </text>

          <text x="12" y="44" fontFamily="Georgia, serif" fontSize="13" fontWeight="700" fill="#171715">
            Analis Bisnis &amp; Data
          </text>
          <text x="12" y="60" fontFamily="sans-serif" fontSize="10" fontWeight="600" fill="#3F3D37">
            Surabaya · Onsite · Kontrak
          </text>

          <rect x="12" y="80" width="152" height="24" rx="4" fill="#ECE8DE" stroke="#171715" strokeWidth="1.5" />
          <text x="30" y="96" fontFamily="sans-serif" fontSize="9.5" fontWeight="700" fill="#171715">
            ★ Simpan ke Bookmark
          </text>
        </g>
      </svg>
    </figure>
  );
}

export function PillarIllustration({ variant }: { variant: 'feed' | 'match' | 'cv' }) {
  if (variant === 'feed') {
    return (
      <div
        aria-hidden="true"
        style={{
          background: '#F6F4EF',
          border: '1.5px solid #171715',
          borderRadius: '6px',
          padding: '10px',
          marginBottom: '14px',
        }}
      >
        <svg viewBox="0 0 320 120" width="100%" height="auto" style={{ display: 'block' }}>
          <rect width="320" height="120" rx="4" fill="#FDFCF9" />
          {/* Search Bar Illustration */}
          <rect x="14" y="14" width="210" height="26" rx="4" fill="#ECE8DE" stroke="#171715" strokeWidth="1.5" />
          <circle cx="28" cy="27" r="5" fill="none" stroke="#171715" strokeWidth="1.8" />
          <line x1="32" y1="31" x2="36" y2="35" stroke="#171715" strokeWidth="1.8" />
          <rect x="46" y="23" width="96" height="7" rx="2" fill="#6B685F" />
          <rect x="232" y="14" width="74" height="26" rx="4" fill="#B84221" stroke="#171715" strokeWidth="1.5" />
          <text x="249" y="31" fontFamily="monospace" fontSize="10" fontWeight="700" fill="#FDFCF9">
            FILTER
          </text>

          {/* Job Cards Stack */}
          <rect x="14" y="50" width="140" height="56" rx="4" fill="#FDFCF9" stroke="#171715" strokeWidth="1.5" />
          <rect x="22" y="58" width="44" height="10" rx="2" fill="#E7F3ED" />
          <rect x="22" y="74" width="102" height="8" rx="2" fill="#171715" />
          <rect x="22" y="88" width="70" height="6" rx="2" fill="#8C887E" />

          <rect x="166" y="50" width="140" height="56" rx="4" fill="#FDFCF9" stroke="#171715" strokeWidth="1.5" />
          <rect x="174" y="58" width="44" height="10" rx="2" fill="#FAEAE5" />
          <rect x="174" y="74" width="110" height="8" rx="2" fill="#171715" />
          <rect x="174" y="88" width="82" height="6" rx="2" fill="#8C887E" />
        </svg>
      </div>
    );
  }

  if (variant === 'match') {
    return (
      <div
        aria-hidden="true"
        style={{
          background: '#F6F4EF',
          border: '1.5px solid #171715',
          borderRadius: '6px',
          padding: '10px',
          marginBottom: '14px',
        }}
      >
        <svg viewBox="0 0 320 120" width="100%" height="auto" style={{ display: 'block' }}>
          <rect width="320" height="120" rx="4" fill="#FDFCF9" />
          {/* Venn / Comparison Circles */}
          <circle cx="115" cy="60" r="42" fill="#FAEAE5" stroke="#171715" strokeWidth="1.5" />
          <circle cx="175" cy="60" r="42" fill="#E7F3ED" stroke="#171715" strokeWidth="1.5" fillOpacity="0.85" />
          <text x="78" y="63" fontFamily="monospace" fontSize="9.5" fontWeight="700" fill="#B84221">
            PROFIL
          </text>
          <text x="172" y="63" fontFamily="monospace" fontSize="9.5" fontWeight="700" fill="#1B5E43">
            SYARAT
          </text>

          {/* Status Legend Pills on Right */}
          <rect x="232" y="24" width="74" height="20" rx="3" fill="#E7F3ED" stroke="#1B5E43" strokeWidth="1.2" />
          <text x="240" y="38" fontFamily="monospace" fontSize="9" fontWeight="700" fill="#1B5E43">
            ✓ COCOK
          </text>
          <rect x="232" y="50" width="74" height="20" rx="3" fill="#FBF1E4" stroke="#8F5112" strokeWidth="1.2" />
          <text x="240" y="64" fontFamily="monospace" fontSize="9" fontWeight="700" fill="#8F5112">
            ! KURANG
          </text>
          <rect x="232" y="76" width="74" height="20" rx="3" fill="#EBE7DD" stroke="#6B685F" strokeWidth="1.2" />
          <text x="240" y="90" fontFamily="monospace" fontSize="9" fontWeight="700" fill="#4F4D46">
            ? UNKNOWN
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{
        background: '#F6F4EF',
        border: '1.5px solid #171715',
        borderRadius: '6px',
        padding: '10px',
        marginBottom: '14px',
      }}
    >
      <svg viewBox="0 0 320 120" width="100%" height="auto" style={{ display: 'block' }}>
        <rect width="320" height="120" rx="4" fill="#FDFCF9" />
        {/* Old CV Document */}
        <rect x="28" y="18" width="84" height="84" rx="4" fill="#ECE8DE" stroke="#171715" strokeWidth="1.5" />
        <rect x="40" y="30" width="44" height="7" rx="2" fill="#6B685F" />
        <rect x="40" y="44" width="60" height="5" rx="2" fill="#8C887E" />
        <rect x="40" y="54" width="52" height="5" rx="2" fill="#8C887E" />
        <rect x="40" y="68" width="58" height="5" rx="2" fill="#8C887E" />
        <text x="40" y="92" fontFamily="monospace" fontSize="8.5" fontWeight="700" fill="#3F3D37">
          IMPOR CV
        </text>

        {/* Transformation Arrow */}
        <path d="M 128 60 L 176 60" stroke="#B84221" strokeWidth="2.5" />
        <polygon points="176,54 188,60 176,66" fill="#B84221" />

        {/* Structured New CV */}
        <rect x="204" y="14" width="92" height="92" rx="4" fill="#171715" />
        <rect x="200" y="10" width="92" height="92" rx="4" fill="#FDFCF9" stroke="#171715" strokeWidth="1.5" />
        <rect x="210" y="20" width="50" height="8" rx="2" fill="#B84221" />
        <rect x="210" y="34" width="72" height="6" rx="2" fill="#171715" />
        <rect x="210" y="46" width="64" height="5" rx="2" fill="#6B685F" />
        <rect x="210" y="56" width="68" height="5" rx="2" fill="#6B685F" />
        <rect x="210" y="74" width="72" height="18" rx="3" fill="#E7F3ED" stroke="#1B5E43" strokeWidth="1" />
        <text x="220" y="86" fontFamily="monospace" fontSize="8.5" fontWeight="700" fill="#1B5E43">
          SIAP EKSPOR
        </text>
      </svg>
    </div>
  );
}

export function EmptyArchiveIllustration(): ReactNode {
  return (
    <svg
      viewBox="0 0 180 110"
      width="160"
      height="98"
      aria-hidden="true"
      style={{ display: 'block', marginBottom: 12 }}
    >
      <rect x="18" y="22" width="144" height="76" rx="6" fill="#ECE8DE" stroke="#171715" strokeWidth="1.5" />
      <rect x="12" y="14" width="144" height="76" rx="6" fill="#FDFCF9" stroke="#171715" strokeWidth="1.8" />
      <rect x="26" y="28" width="54" height="10" rx="2" fill="#FAEAE5" stroke="#B84221" strokeWidth="1" />
      <line x1="26" y1="50" x2="136" y2="50" stroke="#D6D1C4" strokeWidth="2" strokeDasharray="4 4" />
      <line x1="26" y1="64" x2="110" y2="64" stroke="#D6D1C4" strokeWidth="2" strokeDasharray="4 4" />
      <circle cx="132" cy="68" r="14" fill="#FAEAE5" stroke="#171715" strokeWidth="1.5" />
      <path d="M127 68 L137 68 M132 63 L132 73" stroke="#B84221" strokeWidth="2" />
    </svg>
  );
}

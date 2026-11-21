import Image from 'next/image';
import type { ReactNode } from 'react';

export type PageBannerTone = 'sky' | 'mist' | 'sand' | 'sage';

export type PageBannerProps = {
  kicker?: string;
  title: ReactNode;
  subtitle: ReactNode;
  actions?: ReactNode;
  imageSrc: string;
  imageAlt?: string;
  tone?: PageBannerTone;
};

export function PageBanner({
  kicker,
  title,
  subtitle,
  actions,
  imageSrc,
  tone = 'mist',
}: PageBannerProps) {
  return (
    // <header>, bukan <section>: Chrome memperingatkan <h1> di dalam
    // article/aside/nav/section (aturan ukuran bawaan sedang dihapus).
    <header className={`page-banner page-banner--${tone}`}>
      <div className="page-banner__media" aria-hidden="true">
        <Image
          src={imageSrc}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="(max-width: 640px) 92vw, (max-width: 1248px) 96vw, 1200px"
          className="page-banner__img"
        />
        <div className="page-banner__scrim" />
      </div>

      <div className="page-banner__content">
        <div className="page-banner__copy">
          {kicker ? <span className="page-banner__kicker">{kicker}</span> : null}
          <h1 className="page-title page-banner__title">{title}</h1>
          <p className="page-subtitle page-banner__subtitle">{subtitle}</p>
        </div>

        {actions ? <div className="page-banner__actions">{actions}</div> : null}
      </div>
    </header>
  );
}

'use client';

import { motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import type { ReactNode } from 'react';

export type PageBannerTone = 'sky' | 'mist' | 'sand' | 'sage';

export type PageBannerProps = {
  kicker?: string;
  title: ReactNode;
  subtitle: ReactNode;
  actions?: ReactNode;
  imageSrc: string;
  imageAlt: string;
  tone?: PageBannerTone;
};

export function PageBanner({
  kicker,
  title,
  subtitle,
  actions,
  imageSrc,
  imageAlt,
  tone = 'mist',
}: PageBannerProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.section
      className={`page-banner page-banner--${tone}`}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="page-banner__media" aria-hidden="true">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1280px"
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
    </motion.section>
  );
}

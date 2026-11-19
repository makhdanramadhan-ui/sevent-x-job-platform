'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Garis progres scroll tipis 2px di bawah navbar (GPU transform: scaleX).
 */
export function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    let rafId = 0;

    const update = () => {
      rafId = 0;
      const el = barRef.current;
      if (!el) return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
      el.style.transform = `scaleX(${progress})`;
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="tk-scroll-progress" aria-hidden="true">
      <div ref={barRef} className="tk-scroll-progress__bar" />
    </div>
  );
}

/**
 * Scroll Reveal halus dengan IntersectionObserver (menghormati prefers-reduced-motion).
 */
export function ScrollReveal({
  children,
  delayMs = 0,
  className = '',
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    // Immediate check if already in viewport
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -36px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`tk-reveal ${visible ? 'tk-reveal--visible' : ''} ${className}`.trim()}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Momen scroll word-highlight (tasteskill): kata-kata menyala progresif mengikuti posisi scroll.
 */
export function ScrollWordHighlight({
  text,
  accentWords = [],
}: {
  text: string;
  accentWords?: readonly string[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(1);

  const words = text.split(/\s+/).filter(Boolean);
  const accentSet = new Set(accentWords.map((w) => w.toLowerCase()));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setProgress(1);
      return;
    }

    let rafId = 0;

    const compute = () => {
      rafId = 0;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      // Starts lighting up when section enters lower 85% of viewport, completes around upper 32%
      const start = vh * 0.88;
      const end = vh * 0.28;
      const raw = (start - rect.top) / (start - end);
      setProgress(Math.min(1, Math.max(0, raw)));
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(compute);
      }
    };

    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const litCount = Math.round(progress * words.length);

  return (
    <div ref={containerRef} className="tk-word-moment">
      <p className="tk-word-moment__text">
        {words.map((word, idx) => {
          const clean = word.replace(/[.,;:!?]/g, '').toLowerCase();
          const isLit = idx < litCount;
          const isAccent = accentSet.has(clean);
          return (
            <span
              key={`${word}-${idx}`}
              className={`tk-word-moment__word ${isLit ? 'tk-word-moment__word--lit' : ''} ${
                isLit && isAccent ? 'tk-word-moment__word--accent' : ''
              }`.trim()}
            >
              {word}{' '}
            </span>
          );
        })}
      </p>
    </div>
  );
}

/**
 * Scroll-linked vertical progress tracker untuk daftar langkah (Alur 4 Langkah).
 */
export function ScrollStepsProgress({
  children,
}: {
  children: (activeIndex: number, ratio: number) => ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState({ activeIndex: 0, ratio: 0.25 });

  useEffect(() => {
    if (prefersReducedMotion()) {
      setState({ activeIndex: 3, ratio: 1 });
      return;
    }

    let rafId = 0;

    const compute = () => {
      rafId = 0;
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      const anchor = vh * 0.58;
      const traveled = anchor - rect.top;
      const ratio = Math.min(1, Math.max(0, traveled / Math.max(1, rect.height)));
      const activeIndex = Math.min(3, Math.max(0, Math.floor(ratio * 4)));
      setState({ activeIndex, ratio });
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = window.requestAnimationFrame(compute);
      }
    };

    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={wrapRef} className="tk-steps-track">
      <div className="tk-steps-rail" aria-hidden="true">
        <div
          className="tk-steps-rail__fill"
          style={{ transform: `scaleY(${state.ratio})` }}
        />
      </div>
      {children(state.activeIndex, state.ratio)}
    </div>
  );
}

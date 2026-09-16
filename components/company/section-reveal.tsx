'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type InViewOptions = {
  /** Fraction of the element that must be visible before it counts as in view. */
  threshold?: number;
};

/**
 * One-shot IntersectionObserver hook. Once the element has been seen the
 * observer disconnects and `inView` stays true, so nothing replays when the
 * visitor scrolls back up.
 *
 * The hidden start state lives in CSS behind `html[data-js='1']`, not here, so
 * this hook only ever has to flip an attribute on. If IntersectionObserver is
 * missing the element is treated as visible immediately.
 */
export function useInView<T extends HTMLElement>({ threshold = 0.2 }: InViewOptions = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      // No observer available: reveal on the next tick so the content is never
      // left hidden. Deferred rather than set synchronously in the effect body,
      // which would trigger a cascading render.
      const timer = setTimeout(() => setInView(true), 0);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, threshold]);

  return { ref, inView };
}

type RevealProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Reveals a block once, the first time it scrolls ~20% into view:
 * opacity 0 → 1 and translateY(28px) → 0 over 620ms.
 * Use for section headings, panels, and other single blocks.
 */
export function SectionReveal({ children, className }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={className ? `reveal ${className}` : 'reveal'}
      data-revealed={inView ? 'true' : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Same one-shot reveal, but the wrapper itself stays put and its direct
 * children come in with a 90ms stagger. Pass the grid/list class through
 * `className` so this element *is* the grid — no extra wrapper in the layout.
 */
export function RevealGroup({ children, className }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={className ? `reveal-group ${className}` : 'reveal-group'}
      data-revealed={inView ? 'true' : undefined}
    >
      {children}
    </div>
  );
}

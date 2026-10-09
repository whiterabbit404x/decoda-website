'use client';

import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type InViewOptions = {
  /** Fraction of the element that must be visible before it counts as in view. */
  threshold?: number;
  /** Margin around the viewport; the default triggers slightly before the element is fully on screen. */
  rootMargin?: string;
};

/**
 * One-shot IntersectionObserver hook. Once the element has been seen the
 * observer disconnects and `inView` stays true, so nothing replays when the
 * visitor scrolls back up.
 *
 * The hidden start state lives in CSS behind `html[data-js='1']`, not here, so
 * this hook only ever flips an attribute on. Without IntersectionObserver the
 * element is treated as visible on the next tick.
 */
export function useInView<T extends Element>({ threshold = 0.18, rootMargin = '0px 0px -8% 0px' }: InViewOptions = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;

    if (typeof IntersectionObserver === 'undefined') {
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
      { threshold, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, threshold, rootMargin]);

  return { ref, inView };
}

type Tag = 'div' | 'section' | 'ul' | 'ol' | 'li' | 'article' | 'aside' | 'figure' | 'header' | 'dl';

export type RevealVariant = 'up' | 'fade' | 'scale' | 'left' | 'right';

type RevealProps = {
  children?: ReactNode;
  className?: string;
  as?: Tag;
  /** Entrance style. Default: rise and fade in. */
  variant?: RevealVariant;
  /** Milliseconds before this element starts its entrance. */
  delay?: number;
  /** For groups: milliseconds between consecutive children. */
  stagger?: number;
  threshold?: number;
  id?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  role?: string;
  [dataAttribute: `data-${string}`]: string | undefined;
};

function revealStyle(style: CSSProperties | undefined, delay?: number, stagger?: number): CSSProperties | undefined {
  if (delay === undefined && stagger === undefined) return style;
  return {
    ...style,
    ...(delay !== undefined ? { ['--reveal-delay' as string]: `${delay}ms` } : null),
    ...(stagger !== undefined ? { ['--stagger' as string]: `${stagger}ms` } : null),
  };
}

/**
 * Reveals a block once, the first time it scrolls into view. Descendants can
 * key their own sequences off `[data-revealed]` on this element.
 */
export function Reveal({ children, className, as = 'div', variant = 'up', delay, threshold, style, ...rest }: RevealProps) {
  const { ref, inView } = useInView<HTMLElement>({ threshold });
  return createElement(
    as,
    {
      ...rest,
      ref,
      className: className ? `reveal ${className}` : 'reveal',
      'data-variant': variant === 'up' ? undefined : variant,
      'data-revealed': inView ? '' : undefined,
      style: revealStyle(style, delay),
    },
    children,
  );
}

/**
 * The same one-shot reveal for a list or grid: the wrapper stays put and its
 * direct children enter one after another. Pass the grid class through
 * `className` so this element *is* the grid — no extra wrapper.
 */
export function RevealGroup({ children, className, as = 'div', delay, stagger, threshold, style, variant: _variant, ...rest }: RevealProps) {
  const { ref, inView } = useInView<HTMLElement>({ threshold });
  return createElement(
    as,
    {
      ...rest,
      ref,
      className: className ? `reveal-group ${className}` : 'reveal-group',
      'data-revealed': inView ? '' : undefined,
      style: revealStyle(style, delay, stagger),
    },
    children,
  );
}

/**
 * Geometry and colours of the Decoda shield, shared by every rendering of the
 * mark: the inline SVG below, the Open Graph image, and the static favicon set
 * in public/ (public/favicon.svg repeats these values verbatim because it is a
 * static file; components/company/brand-icons.test.ts keeps it in step).
 * Coordinates are in a 40×40 user space.
 */
export const SHIELD_PATH =
  'M20 3.2 33.4 8.1c.7.26 1.2.94 1.2 1.7v9.3c0 8.1-5.1 15.3-12.9 18.1l-1.1.4c-.4.14-.8.14-1.2 0l-1.1-.4C10.5 34.5 5.4 27.3 5.4 19.2V9.8c0-.76.5-1.44 1.2-1.7L20 3.2Z';
export const CHECK_PATH = 'M14 20.4 18.2 24.6 26.6 15.8';

export const SHIELD_COLORS = {
  /** Outline gradient (top-left to bottom-right). */
  stroke: ['#2dd4bf', '#0e7490'],
  /** Solid "strong" fill (top to bottom), used on dark surfaces and for the favicon. */
  fillStrong: ['#0f3b4f', '#07142a'],
  /** Check mark on the strong fill. */
  checkStrong: '#99f6e4',
} as const;

type ShieldProps = {
  /** Rendered pixel size of the square shield mark. */
  size?: number;
  className?: string;
  /** When true the shield renders with a stronger fill for large hero/CTA usage. */
  strong?: boolean;
};

/**
 * Shared SVG gradient definitions for the Decoda shield. Rendered exactly once
 * (in the root layout) so every shield instance can reference these ids without
 * duplicating <defs> or colliding ids — which keeps the mark a pure Server
 * Component with no client JavaScript.
 */
export function DecodaSvgDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <defs>
        <linearGradient id="decoda-shield-stroke" x1="8" y1="3" x2="32" y2="37" gradientUnits="userSpaceOnUse">
          <stop stopColor={SHIELD_COLORS.stroke[0]} />
          <stop offset="1" stopColor={SHIELD_COLORS.stroke[1]} />
        </linearGradient>
        <linearGradient id="decoda-shield-fill-soft" x1="20" y1="3" x2="20" y2="37" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(20, 184, 166, 0.16)" />
          <stop offset="1" stopColor="rgba(11, 29, 56, 0.1)" />
        </linearGradient>
        <linearGradient id="decoda-shield-fill-strong" x1="20" y1="3" x2="20" y2="37" gradientUnits="userSpaceOnUse">
          <stop stopColor={SHIELD_COLORS.fillStrong[0]} />
          <stop offset="1" stopColor={SHIELD_COLORS.fillStrong[1]} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * The Decoda Security shield mark. Drawn as inline SVG so it stays crisp at every
 * size and carries the site's teal accent. This is the canonical brand mark;
 * the favicons in public/ are rendered from the same geometry and colours.
 */
export function DecodaShield({ size = 34, className, strong = false }: ShieldProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d={SHIELD_PATH}
        fill={`url(#decoda-shield-fill-${strong ? 'strong' : 'soft'})`}
        stroke="url(#decoda-shield-stroke)"
        strokeWidth={strong ? 1.6 : 1.8}
      />
      <path
        d={CHECK_PATH}
        stroke={strong ? SHIELD_COLORS.checkStrong : 'url(#decoda-shield-stroke)'}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type LogoProps = {
  /** Shield size in px; the wordmark scales alongside it. */
  size?: number;
  className?: string;
};

/**
 * Full lockup: shield mark + "DECODA / SECURITY" wordmark. Used in the site
 * header and footer. Styling (spacing, wordmark type) comes from the consumer's
 * CSS module via the data attributes below.
 */
export function DecodaLogo({ size = 34, className }: LogoProps) {
  return (
    <span className={className} data-decoda-logo>
      <DecodaShield size={size} />
      <span data-decoda-wordmark>
        <strong>DECODA</strong>
        <span>SECURITY</span>
      </span>
    </span>
  );
}

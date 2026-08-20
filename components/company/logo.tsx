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
          <stop stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="decoda-shield-fill-soft" x1="20" y1="3" x2="20" y2="37" gradientUnits="userSpaceOnUse">
          <stop stopColor="rgba(37, 99, 235, 0.24)" />
          <stop offset="1" stopColor="rgba(8, 20, 40, 0.35)" />
        </linearGradient>
        <linearGradient id="decoda-shield-fill-strong" x1="20" y1="3" x2="20" y2="37" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#0b1c3a" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * The Decoda Security shield mark. Drawn as inline SVG so it stays crisp at every
 * size and inherits the site's electric-blue accent. No raster/logo asset exists
 * in the repository, so this is the canonical brand mark.
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
        d="M20 3.2 33.4 8.1c.7.26 1.2.94 1.2 1.7v9.3c0 8.1-5.1 15.3-12.9 18.1l-1.1.4c-.4.14-.8.14-1.2 0l-1.1-.4C10.5 34.5 5.4 27.3 5.4 19.2V9.8c0-.76.5-1.44 1.2-1.7L20 3.2Z"
        fill={`url(#decoda-shield-fill-${strong ? 'strong' : 'soft'})`}
        stroke="url(#decoda-shield-stroke)"
        strokeWidth={strong ? 1.6 : 1.8}
      />
      <path
        d="M14 20.4 18.2 24.6 26.6 15.8"
        stroke={strong ? '#e0f2fe' : 'url(#decoda-shield-stroke)'}
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

import { ImageResponse } from 'next/og';
import { GUARD } from '@/lib/site/products';
import { POSITIONING } from '@/lib/site/site';

/** The social preview card for every page that does not define its own. */
export const alt = 'Decoda Security — Security and operational infrastructure for tokenized finance';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #0e2342 0%, #07142a 55%, #0a3340 100%)',
          color: '#f1f5f9',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* The radar rings used across the site, drawn with borders (reliable in the OG renderer). */}
        {[620, 440, 260].map((d) => (
          <div
            key={d}
            style={{
              position: 'absolute',
              top: 120 - d / 2,
              right: 160 - d / 2,
              width: d,
              height: d,
              borderRadius: d,
              border: '1.5px solid rgba(94, 234, 212, 0.22)',
              display: 'flex',
            }}
          />
        ))}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, #14b8a6, #06b6d4)', display: 'flex' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 40 40" fill="none">
            <path
              d="M20 3.2 33.4 8.1c.7.26 1.2.94 1.2 1.7v9.3c0 8.1-5.1 15.3-12.9 18.1l-1.1.4c-.4.14-.8.14-1.2 0l-1.1-.4C10.5 34.5 5.4 27.3 5.4 19.2V9.8c0-.76.5-1.44 1.2-1.7L20 3.2Z"
              fill="#0f3b4f"
              stroke="#2dd4bf"
              strokeWidth="1.6"
            />
            <path d="M14 20.4 18.2 24.6 26.6 15.8" stroke="#99f6e4" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: 6 }}>DECODA</span>
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: 9, color: '#5eead4' }}>SECURITY</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', fontSize: 78, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2.5, maxWidth: 960 }}>
            Secure the Future of Tokenized Finance.
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: '#b6c3d6', maxWidth: 900 }}>{POSITIONING}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 24, color: '#9aa8bd' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: 12, background: '#34d399', display: 'flex' }} />
            {`${GUARD.name} — ${GUARD.status.label.toLowerCase()}`}
          </div>
          <div style={{ display: 'flex' }}>decodasecurity.com</div>
        </div>
      </div>
    ),
    size,
  );
}

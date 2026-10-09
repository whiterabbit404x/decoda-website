import type { Metadata } from 'next';
import { SITE_NAME } from './site';

/** app/opengraph-image.tsx, restated because a page's own openGraph replaces the inherited one. */
export const SHARE_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'Decoda Security — Security and operational infrastructure for tokenized finance',
};

/**
 * Metadata for a public page: title, description, canonical URL and matching
 * Open Graph / Twitter cards. Next merges metadata shallowly per key, so each
 * page restates the full openGraph object rather than inheriting half of it.
 * The share image comes from app/opengraph-image.tsx (SHARE_IMAGE).
 */
export function pageMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  const fullTitle = `${title} | ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
      url: path,
      title: fullTitle,
      description,
      images: [SHARE_IMAGE],
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [SHARE_IMAGE.url] },
  };
}

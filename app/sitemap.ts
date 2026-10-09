import type { MetadataRoute } from 'next';
import { SITE_PRODUCTS } from '@/lib/site/products';
import { SITE_URL } from '@/lib/site/site';

/** Public pages only; authenticated and admin surfaces are excluded (see robots.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: Array<{ path: string; priority: number }> = [
    { path: '/', priority: 1 },
    ...SITE_PRODUCTS.map((product, index) => ({ path: product.href, priority: index === 0 ? 0.9 : 0.6 })),
    { path: '/platform', priority: 0.7 },
    { path: '/pricing', priority: 0.8 },
    { path: '/request-pilot', priority: 0.8 },
    { path: '/company', priority: 0.5 },
    { path: '/contact', priority: 0.5 },
    { path: '/privacy', priority: 0.2 },
    { path: '/terms', priority: 0.2 },
    { path: '/refund-policy', priority: 0.2 },
  ];
  return pages.map(({ path, priority }) => ({ url: `${SITE_URL}${path === '/' ? '' : path}`, changeFrequency: 'monthly', priority }));
}

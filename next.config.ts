import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // The RWA Guard product page moved; keep existing links and bookmarks working.
      { source: '/solutions/rwa-security', destination: '/products/guard', permanent: true },
      { source: '/guard', destination: '/products/guard', permanent: false },
    ];
  },
};

export default nextConfig;

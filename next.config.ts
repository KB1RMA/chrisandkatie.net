import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    loader: 'custom',
    loaderFile: './src/image-loader.ts',
  },
  // The standalone /admin/rsvp dashboard was consolidated into the events
  // pages; keep old bookmarks and links working.
  async redirects() {
    return [
      {
        source: '/admin/rsvp',
        destination: '/admin/events',
        permanent: false,
      },
      {
        source: '/admin/rsvp/:eventId',
        destination: '/admin/events/:eventId/rsvps',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
void initOpenNextCloudflareForDev();

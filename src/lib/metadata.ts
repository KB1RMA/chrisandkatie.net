import type { Metadata } from 'next';

const siteUrl = 'https://chrisandkatie.net';
const siteTitle = 'Chris and Katie - Marriage Celebration';
const siteDescription = 'Join us in celebrating Chris and Katie';

/**
 * Base metadata configuration for the site.
 * Includes Open Graph, Twitter Card, and Apple Web App metadata.
 */
export const baseMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: '%s | Chris & Katie',
  },
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: 'Chris and Katie',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Chris and Katie',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: ['/og-image.svg'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Chris & Katie',
  },
};

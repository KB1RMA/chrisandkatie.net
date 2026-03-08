import type { Metadata } from 'next';

const siteUrl = 'https://chrisandkatie.net';
const siteTitle = 'Katie and Chris - Marriage Celebration';
const siteDescription = 'Join us in celebrating Katie and Chris';

/**
 * Base metadata configuration for the site.
 * Includes Open Graph, Twitter Card, and Apple Web App metadata.
 */
export const baseMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: '%s | Katie & Chris',
  },
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName: 'Katie and Chris',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'Katie and Chris',
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
    title: 'Katie & Chris',
  },
};

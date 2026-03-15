import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import { CountdownPageTitle } from '@/components/CountdownPageTitle';
import { SessionProvider } from '@/components/SessionProvider';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { baseMetadata } from '@/lib/metadata';
import './globals.css';

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = baseMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
      </head>
      <body
        className={`${roboto.variable} flex min-h-screen flex-col antialiased`}
      >
        <SessionProvider>
          <Header />
          <CountdownPageTitle />
          {children}
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}

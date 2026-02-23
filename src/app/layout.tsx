import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import { CountdownPageTitle } from '@/components/CountdownPageTitle';
import { PageViewTracker } from '@/components/PageViewTracker';
import { SessionProvider } from '@/components/SessionProvider';
import { Header } from '@/components/Header';
import './globals.css';

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'Chris and Katie - Marriage Celebration',
  description: 'Celebration website for Chris and Katie',
};

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
      <body className={`${roboto.variable} antialiased`}>
        <SessionProvider>
          <Header />
          <CountdownPageTitle />
          <PageViewTracker />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

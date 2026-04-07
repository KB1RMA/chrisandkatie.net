import type { Metadata } from 'next';
import * as Sentry from '@sentry/nextjs';
import { Roboto } from 'next/font/google';
import { CountdownPageTitle } from '@/components/CountdownPageTitle';
import { SessionProvider } from '@/components/SessionProvider';
import { SentryUserProvider } from '@/components/SentryUserProvider';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { auth } from '@/lib/auth';
import { baseMetadata } from '@/lib/metadata';
import './globals.css';

const roboto = Roboto({
  variable: '--font-roboto',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = baseMetadata;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  // Set Sentry user context server-side so server component and server action
  // errors are tagged with the authenticated identity.
  if (session?.user) {
    Sentry.setUser({
      id: session.user.invitationId ?? session.user.username,
      username: session.user.username,
      data: {
        invitationId: session.user.invitationId,
      },
    });
  } else {
    Sentry.setUser(null);
  }

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
      </head>
      <body
        className={`${roboto.variable} flex min-h-screen flex-col antialiased`}
      >
        <SessionProvider>
          <SentryUserProvider />
          <Header />
          <CountdownPageTitle />
          {children}
          <Footer />
        </SessionProvider>
      </body>
    </html>
  );
}

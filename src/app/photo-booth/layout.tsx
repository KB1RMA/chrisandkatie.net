import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth, getAuthIdentity } from '@/lib/auth';

type PhotoBoothLayoutProps = {
  children: React.ReactNode;
};

/**
 * Photo booth route guard layout.
 *
 * Redirects unauthenticated users to login. Renders an access denied message
 * for admin users since the photo booth is guests-only.
 *
 * @param children - Page content rendered for authenticated guests.
 * @returns Redirects, access denied UI, or children based on session state.
 */
export default async function PhotoBoothLayout({
  children,
}: PhotoBoothLayoutProps) {
  const session = await auth();
  const identity = getAuthIdentity(session);

  if (!identity) {
    const headersList = await headers();
    const pathname = headersList.get('x-pathname') ?? '/photo-booth';

    redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  if (identity.type !== 'guest') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-8">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg">
          <h1 className="mb-2 text-2xl font-bold text-[#9e3f3f]">
            Guests Only
          </h1>
          <p className="text-[#6a5555]">
            The photo booth is for wedding guests only.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

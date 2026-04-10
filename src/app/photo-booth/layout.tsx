import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth, getAuthIdentity } from '@/lib/auth';

type PhotoBoothLayoutProps = {
  children: React.ReactNode;
};

/**
 * Photo booth route guard layout.
 *
 * Redirects unauthenticated users to login. Both guests and admins may access
 * the photo booth.
 *
 * @param children - Page content rendered for authenticated users.
 * @returns Redirects unauthenticated users, otherwise renders children.
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

  return <>{children}</>;
}

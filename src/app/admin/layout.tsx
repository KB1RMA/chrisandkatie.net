import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth, getAuthIdentity } from '@/lib/auth';

type AdminLayoutProps = {
  children: React.ReactNode;
};

/**
 * Admin route guard layout.
 *
 * Centralises authentication and role checks for all /admin/* routes.
 * Redirects unauthenticated users to login. Renders an inline Access Denied
 * message for authenticated users without the admin role.
 *
 * @param children - The admin page content to render for authorised users.
 * @returns Redirects, Access Denied UI, or children based on session state.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();
  const identity = getAuthIdentity(session);

  if (!identity) {
    const headersList = await headers();
    const pathname = headersList.get('x-pathname') ?? '/admin';

    redirect(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
  }

  if (identity.type !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-8">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg">
          <h1 className="mb-2 text-2xl font-bold text-[#9e3f3f]">
            Access Denied
          </h1>
          <p className="text-[#6a5555]">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

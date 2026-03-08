import { Marcellus } from 'next/font/google';
import type { Metadata, Route } from 'next';
import Link from 'next/link';

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: 'Admin',
  description: 'Admin dashboard for Chris & Katie.',
};

const adminRoutes: { href: Route; label: string; description: string }[] = [
  {
    href: '/admin/guests',
    label: 'Guests',
    description: 'View and manage individual guest records and RSVP status.',
  },
  {
    href: '/admin/invitations',
    label: 'Invitations',
    description: 'View invitations, assigned codes, and household RSVP status.',
  },
  {
    href: '/admin/events',
    label: 'Events',
    description: 'Manage wedding events and their visibility.',
  },
  {
    href: '/admin/rsvp',
    label: 'RSVP Dashboard',
    description: 'Overall RSVP summary and attendance dashboard.',
  },
  {
    href: '/admin/print-inserts',
    label: 'Print Inserts',
    description: 'Generate printable invitation inserts with QR codes.',
  },
];

/**
 * Admin dashboard index page.
 *
 * Renders a list of available admin routes as navigation cards.
 * Protected by the admin layout — no auth logic needed here.
 *
 * @returns The admin index page.
 */
export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fff7f4] to-[#f3dedb] p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className={`${marcellus.className} mb-2 text-3xl text-[#9e3f3f]`}>
          Admin
        </h1>
        <p className="mb-8 text-[#6a5555]">Chris &amp; Katie — Site Admin</p>

        <nav>
          <ul className="flex flex-col gap-3">
            {adminRoutes.map((route) => (
              <li key={route.href}>
                <Link
                  href={route.href}
                  className="block rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <p className="font-semibold text-[#9e3f3f]">{route.label}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {route.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

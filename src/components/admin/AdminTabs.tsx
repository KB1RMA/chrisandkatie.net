'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export type AdminTab = {
  href: Route;
  label: string;
};

const adminTabs: AdminTab[] = [
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/invitations', label: 'Invitations' },
  { href: '/admin/guests', label: 'Guests' },
];

const baseTabClassName =
  'inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors';

/**
 * Admin navigation tabs for switching between admin views.
 *
 * @returns Admin tabs navigation.
 * @throws {Error} Does not throw.
 */
export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap justify-center gap-2 border-b border-gray-200 pb-4">
      {adminTabs.map((tab) => {
        const isActive =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              baseTabClassName,
              isActive
                ? 'bg-[#9e3f3f] text-white'
                : 'bg-white text-[#6a5555] hover:bg-[#f3dedb] hover:text-[#9e3f3f]',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

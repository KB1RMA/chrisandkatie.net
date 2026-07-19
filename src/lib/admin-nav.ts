import type { Route } from 'next';

export type AdminNavLink = {
  href: Route;
  label: string;
};

/**
 * Admin section links shared by the desktop AdminTabs and the mobile
 * header drawer so the two menus cannot drift apart.
 *
 * The Dashboard link (/admin) is intentionally excluded: AdminTabs marks
 * a tab active when the pathname starts with its href, so /admin would
 * appear active on every admin page. The mobile drawer prepends it
 * separately.
 */
export const ADMIN_NAV_LINKS: AdminNavLink[] = [
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/invitations', label: 'Invitations' },
  { href: '/admin/guests', label: 'Guests' },
  { href: '/admin/seating', label: 'Seating' },
  { href: '/admin/photo-booth', label: 'Photo Booth' },
];

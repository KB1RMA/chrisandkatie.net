import { expect, test, describe, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockPathname = vi.fn(() => '/');
const mockUseSession = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  signOut: vi.fn(),
}));

vi.mock('next/font/google', () => ({
  Great_Vibes: vi.fn(() => ({ className: 'great-vibes-font' })),
}));

const mockGetAuthIdentity = vi.fn();

vi.mock('@/lib/auth', () => ({
  getAuthIdentity: (...args: unknown[]) => mockGetAuthIdentity(...args),
}));

import { Header } from './Header';

describe('Header — navigation', () => {
  test('should render "Hotels & FAQ" link with href="/lodging" when session user is present', () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Test User' } },
      status: 'authenticated',
    });
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-123',
    });

    render(<Header />);

    // Both desktop and mobile nav render the link (mobile drawer is always in the DOM for animation)
    const links = screen.getAllByRole('link', { name: 'Hotels & FAQ' });

    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/lodging'));
  });

  test('should not render "Hotels & FAQ" link when session user is absent', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });
    mockGetAuthIdentity.mockReturnValue(null);

    render(<Header />);

    const link = screen.queryByRole('link', { name: 'Hotels & FAQ' });

    expect(link).not.toBeInTheDocument();
  });

  test('should render admin links in the mobile drawer when user is an admin', () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Admin', roles: ['admin'], username: 'admin' } },
      status: 'authenticated',
    });
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

    render(<Header />);

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/admin',
    );
    expect(screen.getByRole('link', { name: 'Guests' })).toHaveAttribute(
      'href',
      '/admin/guests',
    );
    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute(
      'href',
      '/admin/events',
    );
    expect(screen.getByRole('link', { name: 'Seating' })).toHaveAttribute(
      'href',
      '/admin/seating',
    );
    expect(screen.getByRole('link', { name: 'Photo Booth' })).toHaveAttribute(
      'href',
      '/admin/photo-booth',
    );
  });

  test('should not render admin links when user is a guest', () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Test User' } },
      status: 'authenticated',
    });
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'inv-123',
    });

    render(<Header />);

    expect(
      screen.queryByRole('link', { name: 'Dashboard' }),
    ).not.toBeInTheDocument();
  });
});

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

import { Header } from './Header';

describe('Header — navigation', () => {
  test('should render "Hotels & FAQ" link with href="/lodging" when session user is present', () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Test User' } },
      status: 'authenticated',
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

    render(<Header />);

    const link = screen.queryByRole('link', { name: 'Hotels & FAQ' });

    expect(link).not.toBeInTheDocument();
  });
});

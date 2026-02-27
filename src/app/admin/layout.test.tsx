/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn().mockReturnValue(null),
  })),
}));

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { type Session } from 'next-auth';
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { getByText, queryByText } from '@testing-library/react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminLayout from './layout';

const mockAuth = vi.mocked(auth);
const mockRedirect = vi.mocked(redirect);

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  test('should redirect to login when there is no session', async () => {
    mockAuth.mockResolvedValue(null);

    await expect(
      AdminLayout({ children: <div>Admin Content</div> }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining('/login?callbackUrl='),
    );
  });

  test('should render Access Denied when session user does not have admin role', async () => {
    const mockSession: Session = {
      user: { id: 'user-1', roles: ['guest'] },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const result = await AdminLayout({ children: <div>Admin Content</div> });

    // eslint-disable-next-line testing-library/render-result-naming-convention
    const htmlString = renderToString(result);
    const dom = new JSDOM(htmlString);
    const container = dom.window.document.body;

    // eslint-disable-next-line testing-library/prefer-screen-queries
    expect(getByText(container, /Access Denied/)).toBeInTheDocument();

    // eslint-disable-next-line testing-library/prefer-screen-queries
    expect(queryByText(container, 'Admin Content')).not.toBeInTheDocument();
  });

  test('should render Access Denied when session user has no roles array', async () => {
    const mockSession: Session = {
      user: { id: 'user-1' },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const result = await AdminLayout({ children: <div>Admin Content</div> });

    // eslint-disable-next-line testing-library/render-result-naming-convention
    const htmlString = renderToString(result);
    const dom = new JSDOM(htmlString);
    const container = dom.window.document.body;

    // eslint-disable-next-line testing-library/prefer-screen-queries
    expect(getByText(container, /Access Denied/)).toBeInTheDocument();
  });

  test('should render children when session user has admin role', async () => {
    const mockSession: Session = {
      user: { id: 'user-1', roles: ['admin'] },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    mockAuth.mockResolvedValue(mockSession);

    const result = await AdminLayout({ children: <div>Admin Content</div> });

    // eslint-disable-next-line testing-library/render-result-naming-convention
    const htmlString = renderToString(result);
    const dom = new JSDOM(htmlString);
    const container = dom.window.document.body;

    // eslint-disable-next-line testing-library/prefer-screen-queries
    expect(getByText(container, 'Admin Content')).toBeInTheDocument();

    // eslint-disable-next-line testing-library/prefer-screen-queries
    expect(queryByText(container, /Access Denied/)).not.toBeInTheDocument();
  });
});

/**
 * @vitest-environment node
 */

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  getAuthIdentity: vi.fn(),
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
import { renderToString } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { getByText, queryByText } from '@testing-library/react';
import { auth, getAuthIdentity } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminLayout from './layout';
import { makeSession } from '@/tests/helpers';

const mockAuth = vi.mocked(auth);
const mockGetAuthIdentity = vi.mocked(getAuthIdentity);
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
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(
      AdminLayout({ children: <div>Admin Content</div> }),
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith(
      expect.stringContaining('/login?callbackUrl='),
    );
  });

  test('should render Access Denied when identity is a guest', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({
      type: 'guest',
      invitationId: 'invitation-1',
    });

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

  test('should render Access Denied when identity is null', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue(null);

    await expect(
      AdminLayout({ children: <div>Admin Content</div> }),
    ).rejects.toThrow('NEXT_REDIRECT');
  });

  test('should render children when identity is admin', async () => {
    mockAuth.mockResolvedValue(makeSession());
    mockGetAuthIdentity.mockReturnValue({ type: 'admin', username: 'admin' });

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

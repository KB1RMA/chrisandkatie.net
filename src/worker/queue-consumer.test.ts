/**
 * @vitest-environment node
 */

vi.mock('@/lib/email/notification', async () => {
  const actual = await import('@/lib/email/notification');

  return {
    ...actual,
    sendRsvpNotificationEmail: vi.fn(),
  };
});

import { expect, test, describe, beforeEach, vi } from 'vitest';
import { handleRsvpNotificationQueue } from './queue-consumer';
import {
  sendRsvpNotificationEmail,
  PermanentEmailError,
} from '@/lib/email/notification';
import type { RsvpNotificationPayload } from '@/lib/email/notification';

const mockSendEmail = vi.mocked(sendRsvpNotificationEmail);

/**
 * Creates a minimal mock CloudflareEnv with email secrets.
 */
function makeEnv() {
  return {
    RESEND_API_KEY: 're_test_key',
    OWNER_EMAIL: 'owner@example.com',
  } as unknown as CloudflareEnv;
}

/**
 * Creates a mock MessageBatch with a single message.
 */
function makeBatch(
  payload: RsvpNotificationPayload,
  overrides: {
    ack?: ReturnType<typeof vi.fn>;
    retry?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const ack = overrides.ack ?? vi.fn();
  const retry = overrides.retry ?? vi.fn();

  return {
    messages: [
      {
        body: payload,
        ack,
        retry,
      },
    ],
  } as unknown as MessageBatch<RsvpNotificationPayload>;
}

function makePayload(): RsvpNotificationPayload {
  return {
    isUpdate: false,
    guestName: 'Chris Smith',
    eventName: 'Wedding Reception',
    attendanceStatus: 'attending',
    numberOfAttending: 1,
    specialRequests: null,
    attendees: [
      {
        name: 'Chris Smith',
        mealOption: 'option_a',
        dietaryRestrictions: null,
      },
    ],
  };
}

describe('handleRsvpNotificationQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should call message.ack() when Resend succeeds', async () => {
    mockSendEmail.mockResolvedValue(undefined);

    const ack = vi.fn();
    const batch = makeBatch(makePayload(), { ack });
    const env = makeEnv();

    await handleRsvpNotificationQueue(batch, env);

    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(ack).toHaveBeenCalledOnce();
  });

  test('should call message.ack() on permanent failure (PermanentEmailError)', async () => {
    mockSendEmail.mockRejectedValue(
      new PermanentEmailError('Resend permanent error (400): Invalid email'),
    );

    const ack = vi.fn();
    const retry = vi.fn();
    const batch = makeBatch(makePayload(), { ack, retry });
    const env = makeEnv();

    await handleRsvpNotificationQueue(batch, env);

    expect(ack).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
  });

  test('should call message.retry() on transient failure (network error)', async () => {
    mockSendEmail.mockRejectedValue(
      new Error('Network error: connection refused'),
    );

    const ack = vi.fn();
    const retry = vi.fn();
    const batch = makeBatch(makePayload(), { ack, retry });
    const env = makeEnv();

    await handleRsvpNotificationQueue(batch, env);

    expect(retry).toHaveBeenCalledOnce();
    expect(ack).not.toHaveBeenCalled();
  });
});

/**
 * Cloudflare Queue consumer for RSVP notification messages.
 *
 * Processes each queued RSVP notification by calling the Resend email helper.
 * Uses message.ack() for success and permanent failures, message.retry() for transient failures.
 */
import {
  sendRsvpNotificationEmail,
  PermanentEmailError,
  type RsvpNotificationPayload,
} from '@/lib/email/notification';

/**
 * Handle a batch of RSVP notification queue messages.
 *
 * @param batch - The Cloudflare Queue message batch (max_batch_size = 1).
 * @param env - Cloudflare environment bindings with RESEND_API_KEY and OWNER_EMAIL.
 */
export async function handleRsvpNotificationQueue(
  batch: MessageBatch<RsvpNotificationPayload>,
  env: CloudflareEnv,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      await sendRsvpNotificationEmail(message.body, env);
      message.ack();
    } catch (error) {
      if (error instanceof PermanentEmailError) {
        console.error(
          '[rsvp-notification] Permanent failure — acking:',
          error.message,
        );
        message.ack();
      } else {
        console.error(
          '[rsvp-notification] Transient failure — retrying:',
          error,
        );
        message.retry();
      }
    }
  }
}

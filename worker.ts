// @ts-ignore generated at build time
import { default as handler } from './.open-next/worker.js';
import { handleRsvpNotificationQueue } from './src/worker/queue-consumer';
import type { RsvpNotificationPayload } from './src/lib/email/notification';

export default {
  fetch: handler.fetch,
  queue: handleRsvpNotificationQueue,
} satisfies ExportedHandler<CloudflareEnv, RsvpNotificationPayload>;

import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import * as schema from '@/lib/db/schema';

export type DbClient = DrizzleD1Database<typeof schema>;

/**
 * Get Drizzle database client backed by Cloudflare D1.
 *
 * @returns Drizzle D1 client configured with schema
 * @throws Error when D1 binding is missing
 */
export function getDb(): DbClient {
  const { env } = getCloudflareContext();

  if (!env?.DB) {
    throw new Error('D1 binding is required. This app runs only in Workers.');
  }

  return drizzle(env.DB, { schema });
}

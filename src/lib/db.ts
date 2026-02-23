import { PrismaClient } from '../../prisma/generated/client';
import { PrismaD1 } from '@prisma/adapter-d1';

// Global singleton for local development to avoid connection exhaustion
let prismaClientSingleton: PrismaClient | undefined;

/**
 * Get Prisma client with conditional adapter for local SQLite or Cloudflare D1.
 *
 * @param env - Optional CloudflareEnv with D1 binding (production/staging)
 * @returns PrismaClient configured for the appropriate environment
 */
export async function getPrismaClient(
  env?: CloudflareEnv,
): Promise<PrismaClient> {
  // If D1 binding is available (Cloudflare Workers), use D1 adapter
  if (env?.DB) {
    const adapter = new PrismaD1(env.DB);

    return new PrismaClient({ adapter });
  }

  // Otherwise, use local SQLite (development) with LibSQL adapter
  // Dynamic import to prevent bundling @libsql/client in Cloudflare Workers
  if (!prismaClientSingleton) {
    const { PrismaLibSql } = await import('@prisma/adapter-libsql');
    const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
    const adapter = new PrismaLibSql({ url: databaseUrl });
    prismaClientSingleton = new PrismaClient({ adapter });
  }

  return prismaClientSingleton;
}

/**
 * Legacy fetch handler example - kept for reference.
 * This demonstrates how to use the database in a Cloudflare Worker context.
 */
export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const prisma = await getPrismaClient(env);

    // Example query - adjust based on your needs
    const users = await prisma.user.findMany();
    const result = JSON.stringify(users);

    return new Response(result);
  },
} satisfies ExportedHandler<CloudflareEnv>;

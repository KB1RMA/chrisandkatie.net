import { PrismaD1 } from '@prisma/adapter-d1';
import type { PrismaClient as PrismaClientType } from '@prisma/client';

/**
 * Get Prisma client with conditional adapter for local SQLite or Cloudflare D1.
 *
 * @param env - Optional CloudflareEnv with D1 binding (production/staging)
 * @returns PrismaClient configured for the appropriate environment
 */
export async function getPrismaClient(
  env?: CloudflareEnv,
): Promise<PrismaClientType> {
  if (!env?.DB) {
    throw new Error('D1 binding is required. This app runs only in Workers.');
  }

  const adapter = new PrismaD1(env.DB);
  const edgeClientModule = await import('@prisma/client/edge');
  const PrismaClient =
    edgeClientModule.PrismaClient ?? edgeClientModule.default;

  return new PrismaClient({ adapter }) as PrismaClientType;
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

/**
 * Test stub for the `cloudflare:workers` runtime module, wired up via a
 * resolve alias in vitest.config.ts. Mirrors the ambient declaration in
 * cloudflare-env.d.ts so Durable Object classes can be unit tested outside
 * the workerd runtime.
 */
export abstract class DurableObject<Env = unknown> {
  protected ctx: DurableObjectState;
  protected env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}

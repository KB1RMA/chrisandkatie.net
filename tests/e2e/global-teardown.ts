import fs from 'fs';

import { PID_FILE } from './global-setup';

/**
 * Playwright global teardown — kills the wrangler dev process started by
 * globalSetup. We use the negative PID to target the entire process group,
 * which ensures workerd (spawned as a child of wrangler) is also terminated.
 */
export default async function globalTeardown(): Promise<void> {
  if (!fs.existsSync(PID_FILE)) {
    return;
  }

  const raw = fs.readFileSync(PID_FILE, 'utf-8').trim();
  fs.rmSync(PID_FILE, { force: true });

  const pid = parseInt(raw, 10);

  if (isNaN(pid)) {
    return;
  }

  try {
    // Negative PID kills the process group: wrangler dev + its workerd child.
    process.kill(-pid, 'SIGTERM');
  } catch {
    // Process may have already exited — not an error.
  }
}

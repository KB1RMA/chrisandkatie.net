import { execSync, spawn } from 'child_process';
import fs from 'fs';
import http from 'http';

const REPO_ROOT = process.cwd();
const DB_NAME = 'prisma-demo-db-local';
const PORT = 8787;
const D1_STATE_DIR = `${REPO_ROOT}/.wrangler/state/v3/d1`;

// Written by globalSetup and read by globalTeardown to kill the dev server.
export const PID_FILE = `${REPO_ROOT}/.wrangler/e2e-dev-server.pid`;

/**
 * Polls http://localhost:{PORT} until it responds or the timeout is exceeded.
 *
 * @param timeoutMs - Maximum time to wait in milliseconds.
 */
function waitForServer(timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const check = () => {
      http
        .get(`http://localhost:${PORT}`, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() > deadline) {
            reject(
              new Error(
                `wrangler dev did not start on port ${PORT} within ${timeoutMs}ms`,
              ),
            );

            return;
          }

          setTimeout(check, 500);
        });
    };

    check();
  });
}

/**
 * Playwright global setup — runs once before all tests.
 *
 * The key insight: workerd (the C++ runtime) on Linux runs with a user-namespace
 * sandbox. If we write the SQLite file via the wrangler d1 CLI *before* wrangler dev
 * starts, workerd cannot open a file it didn't create within its sandbox context
 * (SQLITE_CANTOPEN). The fix is to start wrangler dev first so workerd creates and
 * owns the SQLite file, then seed via the wrangler d1 CLI while the server is running.
 *
 * 1. Wipes local D1 state so wrangler dev always starts with a clean database.
 * 2. Starts wrangler dev in the background and waits for it to be ready.
 * 3. Runs all migrations via `wrangler d1 migrations apply`.
 * 4. Seeds E2E test data via `wrangler d1 execute`.
 */
export default async function globalSetup(): Promise<void> {
  const exec = (cmd: string) =>
    execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit' });

  // Wipe the D1 state directory so wrangler dev always initialises a fresh DB.
  console.log('[e2e:setup] Resetting local D1 database...');
  fs.rmSync(D1_STATE_DIR, { recursive: true, force: true });

  // Start wrangler dev BEFORE migrating/seeding. workerd creates the SQLite file
  // on first boot; subsequent wrangler d1 CLI commands then write into that same
  // file, avoiding the SQLITE_CANTOPEN sandbox issue on Linux CI.
  console.log('[e2e:setup] Starting wrangler dev...');
  const devProcess = spawn(
    'npx',
    [
      'wrangler',
      'dev',
      '--local',
      '--port',
      String(PORT),
      '--log-level',
      'error',
    ],
    { cwd: REPO_ROOT, detached: true, stdio: 'ignore' },
  );

  // Unref so the Node.js event loop can exit once globalSetup returns.
  devProcess.unref();

  // Persist PID so globalTeardown can kill wrangler dev + workerd after tests.
  fs.mkdirSync(`${REPO_ROOT}/.wrangler`, { recursive: true });
  fs.writeFileSync(PID_FILE, String(devProcess.pid));

  // Wait for the Worker runtime to be ready before touching the database.
  console.log('[e2e:setup] Waiting for wrangler dev to be ready...');
  await waitForServer();
  console.log('[e2e:setup] Server is ready.');

  // Apply all migrations — schema bootstrap runs first (0000_*),
  // followed by incremental migrations (0002_* through 0005_*).
  console.log('[e2e:setup] Applying D1 migrations...');
  exec(`npx wrangler d1 migrations apply ${DB_NAME} --local`);

  // Seed E2E test data (inserts known invitation + guests for test runs).
  console.log('[e2e:setup] Seeding E2E test data...');
  exec(
    `npx wrangler d1 execute ${DB_NAME} --local --file tests/fixtures/e2e-seed.sql`,
  );

  console.log('[e2e:setup] Database ready.');
}

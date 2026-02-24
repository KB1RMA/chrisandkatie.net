import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Cleanup after each test to ensure no memory leaks
 * and no test pollution between test runs.
 */
afterEach(() => {
  cleanup();
});

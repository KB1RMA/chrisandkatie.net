---
applyTo: '**/*.test.{ts,tsx}'
---

### Test File Conventions

- Test files should use the `/**\n * @jest-environment node\n */` comment when testing Node.js modules
- Use `describe` blocks to group related tests, with clear descriptive names
- Import Jest globals explicitly: `import { expect, test } from '@jest/globals'`
- Mock external dependencies at the top of the test file using `jest.mock()`
- Use meaningful test descriptions that start with "should" (e.g., "should throw error when rate limit is exceeded")

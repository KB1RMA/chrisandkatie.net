---
applyTo: '**/*.test.{ts,tsx}'
---

### Test File Conventions

- Use `describe` blocks to group related tests, with clear descriptive names
- Import ViTest globals explicitly: `import { expect, test } from 'vitest'`
- Mock external dependencies at the top of the test file using `vi.mock()`
- Use meaningful test descriptions that start with "should" (e.g., "should throw error when rate limit is exceeded")
- Avoid mocking whereever possible; prefer testing with real implementations to ensure accurate behavior
- Tests do not need comment blocks unless the test logic is complex and requires explanation. The test name should be explicit enough

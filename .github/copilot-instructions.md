All code responses should be compliant with Prettier version 3 with the following config:
```yaml
singleQuote: true
trailingComma: all
endOfLine: lf
```
This project uses NextJS v16 and React v19 using the App router. All generated code should be compatible with these versions.

### Documentation Standards
- Use JSDoc comments for all exported functions with `@param`, `@returns`, and `@throws` annotations
- Parameter descriptions should follow the pattern: `@param paramName - Description of the parameter.`
- Always add code comments describing what the code does at a high-level rather than details of the implementation.

### Import and Module Patterns
- Use path aliases with `@/` for internal imports (e.g., `@/lib/db`, `@/components/Button`)
- Group imports logically: external libraries first, then internal modules
- Use dynamic imports (`await import()`) in tests when module isolation is needed

### Test File Conventions
- Test files should use the `/**\n * @jest-environment node\n */` comment when testing Node.js modules
- Use `describe` blocks to group related tests, with clear descriptive names
- Import Jest globals explicitly: `import { expect, test } from '@jest/globals'`
- Mock external dependencies at the top of the test file using `jest.mock()`
- Use meaningful test descriptions that start with "should" (e.g., "should throw error when rate limit is exceeded")

### Error Handling
- Include descriptive error messages that help with debugging
- Use proper error logging  with the project's logger instance which implements logging with Pino

### Type Definitions
- Prefer using types over interfaces
- Whenever possible, use library-provided types (e.g., `typeof import('dd-trace')`) instead of custom interfaces

### Code Organization
- Follow the padding-line-between-statements ESLint rule - add blank lines before block statements and returns
- Use meaningful variable names and avoid abbreviations
- Keep functions focused on a single responsibility
- **Follow the Rule of Three**: Wait until you have three similar pieces of code before extracting shared functionality. This prevents premature abstraction and ensures abstractions are based on real usage patterns rather than speculation.
- **Use functional programming patterns**: Favor immutable operations with methods like `.map()`, `.filter()`, `.reduce()`, and `.forEach()` over imperative loops and variable mutation. This promotes safer, more predictable code.
- **Prefer early returns to reduce nesting and improve readability**: Use guard clauses and early returns instead of deeply nested if-else blocks. For example:

```typescript
// ✅ Good - Early return pattern
if (!tracer) {
  return context;
}

const span = tracer.scope().active();

if (span) {
  tracer.inject(span.context(), 'log', context);
}

return context;

// ❌ Avoid - Nested pattern
if (tracer) {
  const span = tracer.scope().active();
  if (span) {
    tracer.inject(span.context(), 'log', context);
  }
}
return context;
```

### Authentication with Next.js Auth v5
- Use Next.js Auth v5 for credential-based authentication with custom providers
- User authentication is tied to Guest records in the database via `guestId` stored in JWT tokens
- Protected routes should check for valid session via `auth()` function and validate guest access permissions
- The Credentials provider authenticates by first/last name lookup against the Guest table

### Database with Prisma
- This project uses Prisma ORM with SQLite for local development and Cloudflare D1 for production
- Always define database models in `prisma/schema.prisma` with appropriate relationships and field constraints
- Run `npx prisma generate` after schema changes to regenerate Prisma client
- Database queries should use the Prisma client instance from `@/lib/db`

### Form Validation with React Hook Form & Zod
- Use react-hook-form paired with Zod for client-side form validation
- Define Zod schemas as `const mySchema = z.object({ ... })` and derive types via `type MyForm = z.infer<typeof mySchema>`
- Use `useForm` hook with `resolver: zodResolver(mySchema)` for validation integration
- Render form errors via the `formState.errors` object with conditional rendering
- Keep validation schemas close to the forms that use them or in a shared `@/lib/schemas` directory if reused

### Guest-Based Access Control
- Pages requiring authentication should use server-side `auth()` to get the session with `guestId`
- Query guest data and permissions server-side, then pass filtered data to client components
- Use the guest record to determine what content/events are visible to the user

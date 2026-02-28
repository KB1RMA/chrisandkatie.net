---
applyTo: '**'
---

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

### Repository Pattern

- **All Drizzle queries MUST live in repository modules** under `src/lib/db/repositories/`. No inline Drizzle queries are permitted in server actions, route handlers, or components.
- **Repository modules are the only entry point to the database**. All reads and writes flow through them, making the data layer independently testable and consistently shaped.
- Repository functions MUST be pure data-access functions: accept typed inputs, return typed outputs, and contain no authentication or business logic.

### Server Action Integrity

- **Every server action MUST validate its input** using a Zod schema before touching any data. Reject invalid input immediately with a descriptive error.
- **Every server action MUST authenticate and authorize the caller** via the `auth()` session before executing any data operation. Do not rely on the UI to enforce access control.
- **Server actions MUST delegate all data access to repository modules**. The action layer is responsible for validation, authorization, and orchestration — not for constructing queries.
- The canonical shape of a server action is:
  ```typescript
  // ✅ Good - Validate → Auth → Repository
  export async function updateRsvp(input: unknown) {
    const data = updateRsvpSchema.parse(input);

    const session = await auth();

    if (!session?.user?.guestId) {
      throw new Error('Unauthorized');
    }

    return rsvpRepository.update(session.user.guestId, data);
  }

  // ❌ Avoid - Inline query, no auth check
  export async function updateRsvp(input: unknown) {
    return db.update(rsvps).set(input).where(eq(rsvps.id, input.id));
  }
  ```

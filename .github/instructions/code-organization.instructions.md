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

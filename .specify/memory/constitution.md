<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.1.0
- Modified principles: V. Quality Gates And Reliability (tests optional → unit tests REQUIRED for all features)
- Added sections: none
- Removed sections: none
- Templates requiring updates:
    ✅ .specify/templates/plan-template.md — Constitution Check quality gates bullet updated
    ✅ .specify/templates/tasks-template.md — tests header and per-story labels updated from OPTIONAL to REQUIRED
    ✅ no change needed .specify/templates/spec-template.md
    ✅ no change needed .specify/templates/checklist-template.md
    ✅ no change needed .specify/templates/agent-file-template.md
- Deferred placeholders: none
-->
# ChrisAndKatie.net Constitution

## Core Principles

### I. Framework-Led Delivery
All product work MUST follow the Next.js App Router conventions and official
framework patterns. Custom structure is only allowed when the framework cannot
support the requirement, and the deviation MUST be justified in the spec.

### II. Functional Core First
Implementation MUST favor functional programming techniques: pure functions,
immutable data, and declarative collection operations such as `map`, `filter`,
and `reduce`. Side effects MUST be isolated at the edges, and functions MUST
remain single-responsibility with early returns.

### III. Specification-First Delivery
Every feature MUST begin with a concise specification that states the user
stories, acceptance scenarios, and success criteria. Implementation work MUST
trace back to that specification and remain minimal to meet it.

### IV. Simplicity And Rule Of Three
Designs MUST stay simple and avoid premature abstraction. Shared utilities or
frameworks MUST only be introduced after three concrete, similar uses exist.

### V. Quality Gates And Reliability
Features MUST meet the defined linting, formatting, and type-checking gates.
Unit tests MUST be written for all server-side logic, server actions, and
utility functions introduced by a feature. Test scope MUST be documented in
the implementation plan before coding begins. Tests MUST be authored before
their corresponding implementation (TDD) and MUST fail before the
implementation is written.

## Technology Constraints

- The product stack is Next.js v16 (App Router), React v19, and TypeScript.
- Formatting MUST match Prettier v3 rules and ESLint configuration.
- Database access MUST use the Drizzle ORM layer and shared schema definitions.
- Authentication MUST use Next.js Auth v5 with guest-based authorization.
- Logging MUST use the project logger for any server-side diagnostics.

## Development Workflow

- Specs, plans, and tasks MUST align with the constitution before delivery.
- Pull requests MUST note compliance with each core principle.
- Deviations MUST be documented in the spec with a clear rationale.
- Changes to the stack or governance MUST update this constitution.

## Governance

- This constitution supersedes other guidance when conflicts arise.
- Amendments MUST be proposed via pull request and include rationale,
	migration impact (if any), and an updated Sync Impact Report.
- Versioning follows semantic versioning: MAJOR for breaking governance
	changes, MINOR for new principles or sections, PATCH for clarifications.
- All plans and reviews MUST include a constitution compliance check.

**Version**: 1.1.0 | **Ratified**: 2026-02-22 | **Last Amended**: 2026-02-26

# Testing Guide

## Commands

| Command | Coverage |
|---|---|
| `npm test` | Runs the deterministic Vitest suite |
| `npm run test:coverage` | Runs Vitest with the V8 coverage provider |
| `npm run type-check` | Runs strict TypeScript checking |
| `npm run lint` | Runs ESLint over source and tests |
| `npm run build` | Runs the production TypeScript/Vite build |
| `npm run verify` | Runs type-check, lint, tests, coverage, build, production audit, and diff checks |

## Test categories

- **Schema tests:** Event, wizard, budget, timeline, vendor, and AI output validation boundaries.
- **Deterministic business tests:** Integer-cent budget arithmetic, paid/actual totals, zero-budget behavior, and over-budget detection.
- **Client regression tests:** Application shell, routes, wizard validation, and preserved wizard values.
- **AI provider tests:** Provider injection allows tests to run without credentials.
- **SQLite persistence smoke test:** With `DATABASE_PROVIDER=sqlite`, the API can be exercised locally without Supabase; the adapter creates its schema and persists events and planning records in `SQLITE_PATH`.
- **Integration limitations:** Supabase persistence and hosted Gemini requests are not required for the normal suite. Keyless local AI can be verified with Ollama or LM Studio when a local model service is installed.

The Phase 0 baseline is 29 test files and 244 passing tests. The master-plan baseline is recorded separately in [MASTER_SCORECARD.md](./MASTER_SCORECARD.md). The current suite is 31 test files and 259 passing tests. Current coverage is 83.28% statements, 69.59% branches, 81.36% functions, and 85.34% lines. Browser lifecycle coverage is available through `npm run test:e2e`; axe accessibility and keyboard checks are available through `npm run test:a11y`.

GitHub Actions reproduces the same checks from a clean Node 22 install. It copies `.env.example` for credential-free SQLite/demo operation, runs `npm run verify`, installs Chromium, and runs the Playwright lifecycle and accessibility suite on every push to `main` and every pull request.

The release gate runs after the build with `npm run release:check`; it is intentionally deterministic and does not require Supabase or Gemini credentials.

## Mocking policy

The AI provider is injected through `setAiProviderForTests`; tests do not call Gemini or spend quota. Browser tests stub `fetch` at the transport boundary for shell and wizard workflows. These tests intentionally do not claim live database or provider coverage.

## Known warnings and future coverage

- Playwright browser lifecycle tests cover landing, wizard progression, birthday creation, all three event types, every primary planning workspace, and mobile axe checks.
- The remaining browser evidence gap is deployed Supabase/authenticated-provider verification.
- Authenticated multi-user integration tests require a configured Supabase environment; local event ownership is covered.
- Supabase service tests should use a repository mock or disposable test project before release.
- SQLite uses Node 24's experimental built-in `node:sqlite`; pin Node 24+ for the credential-free demo path.
- Coverage is reported by the locked `@vitest/coverage-v8` dependency and enforced by the Vitest thresholds.

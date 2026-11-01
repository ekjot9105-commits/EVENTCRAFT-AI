# Master Quality Audit

## Scope and baseline

The audit reviewed the Phase 1–4 React/Express/Supabase modular monolith, shared Zod contracts, Gemini boundary, planning workspaces, routes, tests, configuration, and production build. A checkpoint tag was created at `phase-4-complete-2026-10-27` before remediation.

## Findings and remediation

| Severity | Finding and evidence | Impact | Remediation/status | Verification |
|---|---|---|---|---|
| HIGH | Strict authenticated Bearer-token enforcement is not yet enabled for the anonymous demo. | Hosted multi-user deployments must not rely on client-controlled anonymous identity. | Event ownership and anonymous-session isolation are implemented for the demo; production deployment templates fail closed unless exactly one supported identity mode is configured. Strict auth and hosted RLS remain deployment responsibilities. | Ownership isolation, deployment-config, type-check, tests, build |
| HIGH | Copilot confirmation previously accepted client-supplied mutation values. | A caller could bypass model approval and submit arbitrary budget changes. | Fixed with a server-issued, event-bound, expiring proposal ID and current-value compare-and-swap validation. | Proposal route tests/checks and type/build verification |
| MEDIUM | Alignment documentation described Phase 3–4 features as absent. | Reviewers could not map implemented behavior to the problem statement. | Updated status and implementation documentation. | Documentation diff inspection |
| MEDIUM | Coverage script was configured without `@vitest/coverage-v8`. | Reproducible coverage evidence was unavailable. | Added the configured provider dependency. | `npm run test:coverage` runs in CI with enforced thresholds; latest verified total is 83.32% statements, 69.87% branches, 81.38% functions, 85.39% lines. |
| MEDIUM | Planning UI was create-only and swallowed recoverable workflow failures. | Users could not edit persisted records or reliably recover from save errors. | Added edit/delete/status controls, validation, retry states, and loading guards. | Type-check, lint, build, regression suite |
| LOW | Some feature modules remain dense despite focused service/component extraction. | Review and onboarding cost can increase as features grow. | Kept the current vertical-slice boundaries and added focused tests; further decomposition is optional maintenance. | `npm run lint`, type-check, test suite |

## Criterion assessment

- **Problem alignment:** Wedding, birthday, community event creation; persisted budget/timeline/vendor workspaces; generated ideas; and AI Copilot routes are present. Event-specific AI prompting and structured validation are implemented. Rich event-type templates and full quote comparison remain partial.
- **Code quality:** Strict TypeScript, shared Zod schemas, typed API client, separate AI provider/prompts/service, deterministic budget calculations, and event-scoped services are present. Some feature components remain dense and should be split before a final release.
- **Security:** Secrets remain server-side, bodies are bounded, UUIDs and schemas are validated, AI output is parsed, proposals are server-issued, event ownership is enforced, and production identity-mode validation fails closed. Supabase deployments should still apply and verify the repository RLS migration before public launch.
- **Efficiency:** AI calls are explicit, bounded, and rate-limited; budget arithmetic is local and deterministic. Dashboard, planning, idea, and plan-history list queries are capped at the newest 100 records in both persistence adapters. Public-scale deployments should add cursor pagination if histories can exceed that cap.
- **Testing:** 260 deterministic tests pass with enforced coverage thresholds, plus real-browser lifecycle and axe accessibility coverage through Playwright. Live Supabase/hosted-model and keyless local-model verification remain optional and require their respective services.
- **Reproducibility:** GitHub Actions now runs the clean-install verification, production audit, Playwright lifecycle, and accessibility checks on every pull request and `main` push.
- **Release safety:** `npm run release:check` guards the environment contract, tracked-secret hygiene, production artifact presence, and the 450 kB client-entry budget.
- **Accessibility:** Semantic landmarks, labels, focus styles, live AI status, button names, retry/error text, component-level axe checks, and real-browser axe/keyboard checks for all primary routes at a mobile viewport are present.

## Dependency audit

React Router was upgraded to 7.18.5, which resolves both moderate advisories (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg). `npm audit` now reports 0 vulnerabilities, and CI fails on any moderate-or-higher production advisory.

## Scorecard hardening pass

| Area | Change |
|---|---|
| Testing | Per-worker SQLite files remove the `database is locked` failure under `--coverage`; 260 tests cover provider adapters and fallbacks, security middleware, the proposal applier, the API client, shared components, deployment modes, and routed pages; Playwright covers the browser lifecycle, axe accessibility, and keyboard interaction; coverage thresholds are enforced in CI. |
| Accessibility | Component-level axe-core checks cover shared components and routed pages; real-browser axe and keyboard checks cover all primary routes at mobile width. Skipped heading levels, broken skip links, duplicate modal IDs, toast roles, navigation states, AI canvas labeling, dialog focus behavior, and reduced-motion behavior were addressed. |
| Security | AI rate limit is now per session *and* per IP (rotating `x-anon-id` no longer bypasses it), memory-bounded, and sends `Retry-After`; session IDs and request IDs are format-validated; session cookie is `Secure` in production; `trust proxy` on Vercel; inline boot script moved to a CSP-compatible file. |
| Code quality | `provider.ts` split into per-adapter modules with one JSON parser and one provider resolver; Copilot confirmation rewritten as a table-driven applier that applies the same schema, stale-value, and schedule rules to every action; expected failures in the AI service return 4xx/502 instead of 500. |
| Alignment | Copilot savings advice uses the event's own currency; Gemini honours `GEMINI_MODEL` instead of silently downgrading it. |

### Second pass

| Area | Change |
|---|---|
| Code quality | API routers mounted once under `/api` (the Vercel entry restores a stripped prefix); providers receive the trusted event as structured context instead of re-parsing prompt text; `AICopilot`, `TimelineWorkspace`, `CelebrationHeroCanvas`, and `Budget3DDonut` split into focused components and pure, unit-tested modules; one shared currency list. |
| Efficiency | Applying a plan writes each section as one batch (a single SQLite transaction or one Supabase request per table) in parallel; plan and item lookups use primary keys instead of listing; prepared SQLite statements are cached; planning saves refresh only the affected records instead of remounting the workspace and re-fetching the event. |
| Security | Generated ideas are now schema-validated like every other model output; invalid model output returns 502 instead of 500; SQLite writes use a per-table column allowlist. |
| Accessibility | White-on-brand controls darkened to ≥ 4.98:1 contrast (WCAG AA); view and filter toggles expose `aria-pressed`; row actions name their item; Copilot replies are announced through a live region; saves no longer reset the chosen view or keyboard focus. |
| Alignment | INR budgets supported end to end (API, wizard, Supabase migration `005`); budget and plan screens show the event's own currency; events with no budget can still generate a plan. |

## Verification

Run:

```text
npm run type-check
npm test
npm run lint
npm run build
npm run test:coverage
git diff --check
```

The final report records the actual results and remaining warnings. The latest verified run reports 83.32% statements, 69.87% branches, 81.38% functions, and 85.39% lines across the configured source scope. See [MASTER_SCORECARD.md](./MASTER_SCORECARD.md) for the original non-regression reference.

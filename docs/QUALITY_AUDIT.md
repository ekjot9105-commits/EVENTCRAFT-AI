# Phase 5 Quality Audit

## Scope and baseline

The audit reviewed the Phase 1–4 React/Express/Supabase modular monolith, shared Zod contracts, Gemini boundary, planning workspaces, routes, tests, configuration, and production build. A checkpoint tag was created at `phase-4-complete-2026-10-27` before remediation.

## Findings and remediation

| Severity | Finding and evidence | Impact | Remediation/status | Verification |
|---|---|---|---|---|
| HIGH | Strict authenticated Bearer-token enforcement is not yet enabled for the anonymous demo. | Hosted multi-user deployments must not rely on client-controlled anonymous identity. | Event ownership and anonymous-session isolation are implemented for the demo; strict auth and hosted RLS remain a follow-up phase. | Ownership isolation tests, type-check, tests, build |
| HIGH | Copilot confirmation previously accepted client-supplied mutation values. | A caller could bypass model approval and submit arbitrary budget changes. | Fixed with a server-issued, event-bound, expiring proposal ID and current-value compare-and-swap validation. | Proposal route tests/checks and type/build verification |
| MEDIUM | Alignment documentation described Phase 3–4 features as absent. | Reviewers could not map implemented behavior to the problem statement. | Updated status and implementation documentation. | Documentation diff inspection |
| MEDIUM | Coverage script was configured without `@vitest/coverage-v8`. | Reproducible coverage evidence was unavailable. | Added the configured provider dependency. | `npm run test:coverage` runs in CI with enforced thresholds; latest verified total is 82.96% statements, 68.66% branches, 81.13% functions, 85.10% lines. |
| MEDIUM | Planning UI was create-only and swallowed recoverable workflow failures. | Users could not edit persisted records or reliably recover from save errors. | Added edit/delete/status controls, validation, retry states, and loading guards. | Type-check, lint, build, regression suite |
| LOW | Three lint warnings remain in existing Toast fast-refresh export and server startup logging. | No functional failure; code-quality noise remains. | Documented for later cleanup without suppressing the rules. | `npm run lint` |

## Criterion assessment

- **Problem alignment:** Wedding, birthday, community event creation; persisted budget/timeline/vendor workspaces; generated ideas; and AI Copilot routes are present. Event-specific AI prompting and structured validation are implemented. Rich event-type templates and full quote comparison remain partial.
- **Code quality:** Strict TypeScript, shared Zod schemas, typed API client, separate AI provider/prompts/service, deterministic budget calculations, and event-scoped services are present. Some feature components remain dense and should be split before a final release.
- **Security:** Secrets remain server-side, bodies are bounded, UUIDs and schemas are validated, AI output is parsed, and proposals are now server-issued. Missing authentication/ownership/RLS is the primary unresolved risk.
- **Efficiency:** AI calls are explicit, bounded, and rate-limited; budget arithmetic is local and deterministic. No private response cache exists. List endpoints still need pagination for public-scale deployment.
- **Testing:** 244 deterministic tests pass with enforced coverage thresholds. Live Supabase/hosted-model and browser E2E tests remain optional; keyless local-model verification requires Ollama or LM Studio to be installed.
- **Accessibility:** Semantic landmarks, labels, focus styles, live AI status, button names, retry/error text, and component-level axe checks are present. Real-browser axe and full keyboard E2E evidence remain future work.

## Dependency audit

React Router was upgraded to 7.18.5, which resolves both moderate advisories (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg). `npm audit` now reports 0 vulnerabilities, and CI fails on any moderate-or-higher production advisory.

## Scorecard hardening pass

| Area | Change |
|---|---|
| Testing | Per-worker SQLite files remove the `database is locked` failure under `--coverage`; 244 tests cover provider adapters and fallbacks, security middleware, the proposal applier, the API client, shared components, and routed pages; coverage thresholds are enforced in CI. |
| Accessibility | Component-level axe-core checks cover shared components and routed pages; skipped heading levels, broken skip links, duplicate modal IDs, toast roles, navigation states, AI canvas labeling, and reduced-motion behavior were addressed. Real-browser accessibility testing remains a future phase. |
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

The final report records the actual results and remaining warnings. The latest coverage run reports 82.96% statements, 68.66% branches, 81.13% functions, and 85.10% lines across the configured source scope.

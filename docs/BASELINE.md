# Phase 0 Baseline

Captured on 2026-11-01 at commit `87969ad742dcc914a3b8e91dc8ae55e55377a1eb`.

## Repository state

- Branch: `main`
- Remote: `origin/main`
- Working tree: clean before Phase 0/1 changes
- Node requirement: `>=22` (Node 24 recommended for native `node:sqlite`)
- Database default: local SQLite
- AI default: deterministic local provider

## Quality gates

| Gate | Result |
|---|---|
| `npm run type-check` | Passed |
| `npm run lint` | Passed |
| `npm test` | 29 files, 244 tests passed |
| `npm run test:coverage` | Passed configured thresholds |
| `npm run build` | Passed |
| `npm audit --omit=dev --audit-level=moderate` | 0 production vulnerabilities |
| `git diff --check` | Passed |

## Coverage

| Metric | Result |
|---|---:|
| Statements | 83% |
| Branches | 68.6% |
| Functions | 81.28% |
| Lines | 85.1% |

## Known non-failing warnings

- Node reports that the native SQLite API is experimental.
- JSDOM reports that `HTMLCanvasElement.getContext()` is not implemented; canvas behavior is covered through mocks and accessibility assertions.
- Vite reports a 625.40 kB minified JavaScript chunk, above its 500 kB advisory threshold.

This file is the regression reference for subsequent implementation phases. Later phases must preserve the passing gates and must not reduce the configured coverage thresholds.

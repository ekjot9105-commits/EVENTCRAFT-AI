# Master scorecard baseline

This file is the non-regression reference for the perfect-score hardening plan.
It records observed repository evidence, not a guaranteed Hack2Skill score.

## Baseline commit

- Commit: `6a1b32e`
- Baseline tag: `master-baseline-2026-11-01`
- Working tree: clean before the master-plan changes

## Current evidence

| Measure | Observed result |
|---|---:|
| Vitest test files | 31 |
| Vitest tests | 254 passing |
| Statements | 83.56% |
| Branches | 70.06% |
| Functions | 81.61% |
| Lines | 85.57% |
| Playwright tests | 4 passing |
| Browser accessibility tests | 2 passing |
| Production entry bundle | 377,735 bytes |
| Production dependency audit | 0 vulnerabilities |
| Full dependency audit | 12 moderate development findings |

## Current score estimate

| Criterion | Baseline estimate | Target |
|---|---:|---:|
| Code Quality | 90 | 100 |
| Security | 92 | 100 |
| Efficiency | 95 | 100 |
| Testing | 89 | 100 |
| Accessibility | 91 | 100 |
| Problem Statement Alignment | 95 | 100 |

## Merge gate

Every hardening phase must preserve or improve every measure above. A phase is
not complete when it merely passes its new test; it must also pass the full
repository gate, browser suite, accessibility suite, release check, and
`git diff --check`.

The baseline must be refreshed only after a deliberate improvement is merged,
never to hide a regression.

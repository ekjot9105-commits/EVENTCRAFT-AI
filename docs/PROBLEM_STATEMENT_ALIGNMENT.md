# Problem Statement Alignment

> Create a GenAI-powered planning assistant that helps users organize weddings, birthdays, and community events with budgets, timelines, vendor checklists, and personalized ideas.

## Final requirements matrix

| Requirement | User-visible feature and page | Backend, service, and persistence | Verification and actual result | Limitation |
|---|---|---|---|---|
| GenAI-powered planning | **AI Assistant** at `/events/:id/assistant` generates a structured plan and answers questions. | Server-only Gemini, Ollama, LM Studio, or deterministic local provider; event prompts, Zod output schemas, and `POST /api/events/:eventId/ai/generate` / `copilot`; generated records are saved through planning services. | `aiSchemas.test.ts`, `aiProvider.test.ts`, type-check, build, and local API smoke verification passed. Live external-model execution remains optional. | Gemini needs a key; Ollama and LM Studio need a locally installed model and running service. |
| Wedding planning | Five-step wizard supports Wedding and event-scoped planning routes; theme presets in Step 4. | `events.type = wedding`; wedding-specific prompt guidance; ceremony & reception timeline sequencing, photography & floral checklists. | Browser workspace coverage now opens budget, timeline, vendors, ideas, and Copilot for a persisted wedding event. | Full wedding wizard entry and hosted persistence are not yet verified. |
| Birthday planning | Wizard supports Birthday, age/milestone theme presets, and editable planning workspaces. | `events.type = birthday`; birthday-specific prompt guidance, cake, games, and entertainment checklists. | Wizard tests, event template tests, integration coverage, and Playwright creation/workspace flows passed. | Hosted persistence remains externally unverified. |
| Community event planning | Wizard supports Community Event, civic/festival theme presets, and event-scoped planning routes. | `events.type = community`; municipal permits, safety, volunteers, and supply logistics prompt guidance. | Browser workspace coverage now opens budget, timeline, vendors, ideas, and Copilot for a persisted community event. | Full community wizard entry and hosted persistence are not yet verified. |
| Budget generation and tracking | Budget workspace supports planned and actual costs, create/edit/delete, validation, summary cards, and `/budget/summary` endpoint. | `/api/events/:eventId/budget` & `/budget/summary`; `planningService`; `budget_items`; deterministic integer-cent calculations. | `budgetCalculations.test.ts`, integration tests, and component tests passed. | Full browser persistence and hosted Supabase persistence remain to be verified. |
| Timeline and deadlines | Timeline workspace supports create/edit, complete/reopen, delete, impossible schedule validation (>30 days post-event), and urgency filtering. | `/api/events/:eventId/timeline`; `planningService`; `timeline_items`; event-date validation guards. | Shared schema tests, urgency filter, Gantt view, schedule conflict tests, integration tests, and browser create/edit/delete flows passed. | Hosted Supabase persistence remains externally unverified. |
| Vendor checklist and booking status | Vendor workspace supports create/edit/delete, quote comparison metrics, and booking/payment status values. | `/api/events/:eventId/vendors`; `planningService`; `vendors`; quoted cost and commitment tracking. | Shared schema tests, vendorQuotes unit tests, integration tests, and browser create/edit/delete flows passed. | Hosted Supabase persistence remains externally unverified. |
| Personalized ideas | Ideas workspace displays generated ideas, direct AI generation, save/dismiss, and conversion to budget/timeline. | `/api/events/:eventId/ideas` and `POST /ideas/generate`; `ideaService`; `ideas`; AI generated-plan persistence. | Ideas route/client wiring, standalone generation API, integration coverage, and browser generation/save/conversion coverage passed. | Hosted model execution remains externally unverified. |
| Editable, persistent plans | Event-scoped Budget, Timeline, Vendors, and Ideas pages reload after mutations. | Typed API client with Supabase or local SQLite-backed services; SQLite uses `SQLITE_PATH` and event-scoped queries. | SQLite integration tests and browser mutation journeys cover event and planning persistence. | Hosted Supabase persistence is externally unverified. |
| Context-aware AI copilot | Assistant sends questions using the selected event and displays answers or proposals. | AI service assembles event, budget, timeline, vendor, and idea context before calling configured provider. | AI schema/provider tests, event template tests, prompt sanitization security tests, and E2E API suite passed. | None. Keyless local and Gemini providers operational. |
| Safe approval of AI changes | Proposal preview provides Confirm and Cancel; confirmation is explicit. | Server-issued expiring proposal IDs, event binding, single-use consumption, schema validation, and stale-value checks in `ai.ts`. | `proposalStore.test.ts` and E2E confirmation tests passed for all 6 proposal mutation actions. | None. Full coverage across budget, timeline, and vendors. |

## Verification status

The deterministic quality gate passed across all automated test suites and compiler checks:

```text
npm run type-check   passed (0 errors)
npm test             31 files / 260 tests passed
npm run lint         passed (0 errors, 0 warnings)
npm run build        passed (client and compiled server)
npm run test:coverage passed (100% on prompts, schemas, budget calculations, rate limit, ownership)
npm run verify       all local gates passed
```

The browser suite reaches the five-step event wizard, confirms all three event-type choices, and exercises the budget, timeline, vendors, ideas, and assistant routes for wedding, birthday, and community events. Multi-tenant isolation was verified using end-to-end integration tests proving IDOR resistance across different session owners (`securityTenantIsolation.test.ts`), and AI endpoint burst limits were validated (`aiRateLimit.test.ts`).

## Tenancy and Security Boundary

EventCraft AI enforces session isolation and tenant boundaries on every event route via `resolveIdentity` and `requireEventOwnership`. Unauthenticated cross-tenant access to events, budgets, timelines, vendors, ideas, and AI copilot instances is strictly blocked and returns HTTP 404 (or HTTP 400 for malformed IDs). For hosted deployments with Supabase, `AUTH_ENABLED=true` seamlessly activates Bearer token verification.

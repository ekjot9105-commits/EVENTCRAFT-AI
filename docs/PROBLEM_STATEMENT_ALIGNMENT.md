# Problem Statement Alignment

> Create a GenAI-powered planning assistant that helps users organize weddings, birthdays, and community events with budgets, timelines, vendor checklists, and personalized ideas.

## Final requirements matrix

| Requirement | User-visible feature and page | Backend, service, and persistence | Verification and actual result | Limitation |
|---|---|---|---|---|
| GenAI-powered planning | **AI Assistant** at `/events/:id/assistant` generates a structured plan and answers questions. | Server-only Gemini provider, event prompts, Zod output schemas, and `POST /api/events/:eventId/ai/generate` / `copilot`; generated records are saved through planning services. | `aiSchemas.test.ts`, `aiProvider.test.ts`, type-check, build, and route inspection passed. Live Gemini execution was not run without credentials. | Requires `GEMINI_API_KEY` for live generation. |
| Wedding planning | Five-step wizard supports Wedding and event-scoped planning routes. | `events.type = wedding`; wedding-specific prompt guidance; event row in Supabase. | Browser inspection confirmed the Wedding selection and wizard controls. Persistence flow is covered by wizard tests but live save was unavailable without Supabase. | Dedicated wedding templates are limited. |
| Birthday planning | Wizard supports Birthday and the same editable planning workspaces. | `events.type = birthday`; birthday-specific prompt guidance; event row in Supabase. | Browser inspection confirmed the Birthday option; shared schema and wizard tests passed. | Age-specific templates are limited. |
| Community event planning | Wizard supports Community Event and event-scoped planning routes. | `events.type = community`; community logistics prompt guidance; event row in Supabase. | Browser inspection confirmed the Community Event option; shared schema and wizard tests passed. | Permission and volunteer templates are limited. |
| Budget generation and tracking | Budget workspace supports planned and actual costs, create/edit/delete, validation, and summaries. | `/api/events/:eventId/budget`; `planningService`; `budget_items`; deterministic integer-cent calculations. | `budgetCalculations.test.ts` passed; 100% covered budget calculation module; UI route is wired to the typed API client. | Live persistence and database failure recovery require Supabase. |
| Timeline and deadlines | Timeline workspace supports create/edit, complete/reopen, delete, and date validation. | `/api/events/:eventId/timeline`; `planningService`; `timeline_items`. | Shared schema tests, type-check, build, and route inspection passed. | Overdue filtering and richer sorting remain limited. |
| Vendor checklist and booking status | Vendor workspace supports create/edit/delete and constrained booking/payment status values. | `/api/events/:eventId/vendors`; `planningService`; `vendors`. | Shared schema tests, type-check, build, and route inspection passed. | Quote comparison and payment totals are not fully integrated into budget summaries. |
| Personalized ideas | Ideas workspace displays generated ideas and supports save/dismiss actions. | `/api/events/:eventId/ideas`; `ideaService`; `ideas`; AI generated-plan persistence. | Ideas route/client wiring, build, and route inspection passed. | Standalone regeneration UI is limited; live AI output was not run. |
| Editable, persistent plans | Event-scoped Budget, Timeline, Vendors, and Ideas pages reload after mutations. | Typed API client and Supabase-backed services with event-scoped queries. | Persistence contracts and UI mutation paths were audited; live refresh persistence was not executable without Supabase credentials. | No authentication, ownership, or RLS for multi-user deployment. |
| Context-aware AI copilot | Assistant sends questions using the selected event and displays answers or proposals. | AI service assembles event, budget, timeline, vendor, and idea context before calling Gemini. | AI schema/provider tests and route inspection passed; live context response was not run without Gemini/Supabase credentials. | Authentication/ownership is required before private multi-user deployment. |
| Safe approval of AI changes | Proposal preview provides Confirm and Cancel; confirmation is explicit. | Server-issued expiring proposal IDs, event binding, single-use consumption, schema validation, and stale-value comparison in `ai.ts`. | `proposalStore.test.ts` passed; invalid/stale/cross-event behavior is guarded in the confirmation route. | Supported confirmation actions currently cover budget updates/additions, not timeline/vendor mutations. |

## Verification status

The deterministic quality gate passed after the final production fixes:

```text
npm run type-check   passed
npm test             10 files / 55 tests passed
npm run lint         passed with 3 warnings
npm run build        passed (client and compiled server)
npm run test:coverage passed
git diff --check     passed
```

The browser smoke check reached the five-step event wizard and confirmed all three event-type choices. The dashboard could not load saved events because this environment has no Supabase credentials; the UI displayed an explicit error instead of fabricated data.

## Deployment boundary

The current application is a single-user/demo deployment. Event routes do not authenticate an actor, the schema has no `user_id` or membership model, and Supabase RLS is not configured. Production API requests return `503` unless `AUTH_ENABLED=true`. Do not enable that flag until authentication, ownership checks, and RLS are implemented.

# Problem Statement Alignment

> Create a GenAI-powered planning assistant that helps users organize weddings, birthdays, and community events with budgets, timelines, vendor checklists, and personalized ideas.

## Status definitions

- **Implemented:** The user-visible route, API/service path, persistence contract, and automated evidence exist.
- **Partial:** The core path exists, but a named limitation remains.
- **Open:** The requirement depends on a later security or infrastructure boundary.

## Requirement mapping

| Requirement | UI and route | Backend and persistence | Status and evidence |
|---|---|---|---|
| GenAI planning assistant | `/events/:id/assistant` provides plan generation and copilot questions. | Server-only Gemini provider, event prompts, Zod output schemas, AI service, and `/api/events/:eventId/ai/*`. | **Partial:** Requires `GEMINI_API_KEY`; live smoke test is optional. |
| Wedding planning | Wizard event type and event detail route. | `events.type = wedding`; wedding-specific prompt guidance. | **Partial:** Core planning works; dedicated wedding template defaults remain limited. |
| Birthday planning | Wizard event type and event detail route. | `events.type = birthday`; birthday-specific prompt guidance. | **Partial:** Core planning works; age-specific templates remain limited. |
| Community event planning | Wizard event type and event detail route. | `events.type = community`; community logistics prompt guidance. | **Partial:** Core planning works; permission/volunteer templates remain limited. |
| Budgets and expenses | `/events/:id/budget` supports create, edit, actual cost, and delete. | Planning service, budget routes, Supabase `budget_items`, deterministic integer-cent calculations. | **Implemented:** Budget arithmetic is not delegated to AI. |
| Timeline and deadlines | `/events/:id/timeline` supports create, edit, complete/reopen, and delete. | Timeline routes/service and Supabase `timeline_items`; ISO date validation. | **Partial:** Overdue filtering and richer sorting remain limited. |
| Vendor checklist and booking status | `/events/:id/vendors` supports create, edit, status, and delete. | Vendor routes/service and Supabase `vendors`; constrained status values. | **Partial:** Quote comparison and payment totals are not yet integrated into budget summary. |
| Personalized ideas | `/events/:id/ideas` safely displays generated ideas and supports save/dismiss. | Generated plan writes `ideas`; event-scoped ideas service/routes. | **Partial:** Regenerate action and standalone idea generation UI remain limited. |
| Saved editable plans | Planning workspaces reload records from the API after mutations. | Supabase persistence for events, budget, timeline, vendors, and ideas. | **Implemented for available modules:** Live verification requires Supabase credentials. |
| Context-aware copilot | Assistant page sends questions and displays answers/proposals. | Context is assembled from the selected event and its planning records. | **Partial:** Authentication/ownership is required before private multi-user deployment. |
| Validated AI changes | Copilot proposal preview offers confirmation/cancel. | Server-issued expiring proposal IDs, event binding, schema validation, and current-value comparison. | **Implemented for supported budget actions:** Timeline/vendor proposal application is not yet supported. |

## Evidence

- `npm test` covers schemas, budget calculations, provider injection, shell, and wizard workflows.
- `npm run type-check`, `npm run lint`, and `npm run build` are required gates.
- Live Gemini and Supabase checks are optional because credentials are not committed.

## Important deployment limitation

The current application is a single-user/demo deployment. Event routes do not authenticate an actor, the schema has no `user_id` or membership model, and Supabase RLS is not configured. Do not expose this API to untrusted users until ownership, authentication, and RLS are implemented.

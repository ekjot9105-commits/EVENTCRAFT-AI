# Problem Statement Alignment

> **Problem statement:** Create a GenAI-powered planning assistant that helps users organize weddings, birthdays, and community events with budgets, timelines, vendor checklists, and personalized ideas.

## Audit baseline

The current repository has event CRUD, persistent planning workspaces, and an optional server-side Gemini integration. Ideas are persisted by generated plans, while richer standalone idea editing remains planned. The status below is based on executable behavior, not on schema or UI intent alone.

| Status | Meaning |
|---|---|
| ✅ | Implemented and covered by an executable acceptance test |
| 🔧 | Partially implemented; the missing behavior is named |
| ❌ | Not implemented |

## Requirement mapping

### 1. GenAI-powered planning assistant — ⚠️ Partial

| Concern | Current or planned mapping |
|---|---|
| Feature/page | `/events/:id/assistant` provides structured plan generation and context-aware questions through server-only Gemini routes; live credentials are required. |
| Backend/service | Planned `POST /api/events/:id/assistant/message` and `assistantService`; no route, Gemini client, or service currently exists. |
| Persistence | Existing migration defines `assistant_messages(event_id, role, content, structured_actions, created_at)`, but no code writes or reads it. |
| Acceptance test | Create a wedding with budget items, ask “How can I reduce my budget by 20%?”, verify the response references actual items, apply a validated action, and reload to verify the change and conversation persist. |

### 2. Wedding planning — 🔧

| Concern | Current or planned mapping |
|---|---|
| Feature/page | `/events/new` lets the user select Wedding; `/events/:id` displays the type and core details. Wedding-specific fields, templates, and categories are absent. |
| Backend/service | Existing event CRUD endpoints and `eventService`; no wedding-specific defaults or metadata validation. |
| Persistence | `events.type` supports `wedding`; `metadata` can hold future structured fields. There is no `user_id` ownership column. |
| Acceptance test | Create a wedding with couple/style fields, verify validated metadata is stored, reload it, and verify wedding-specific budget/timeline/vendor templates appear. |

### 3. Birthday planning — 🔧

The type selector, schema, database check constraint, and core CRUD support `birthday`. Birthday-specific person/age/theme fields, defaults, UI, and persistence tests are missing. Acceptance: create a birthday with those fields, reload it, and verify birthday-specific templates and persisted values.

### 4. Community event planning — 🔧

The type selector, schema, database check constraint, and core CRUD support `community`. Organization, permit, volunteer, sponsor, and logistics fields are missing. Acceptance: create a community event with those fields, reload it, and verify community-specific templates and persisted values.

### 5. Budget generation and tracking — ⚠️ Partial

| Concern | Current or planned mapping |
|---|---|
| Feature/page | `/events/:id/budget` now supports persisted budget item creation, listing, and deletion. AI-generated budgets remain planned. |
| Backend/service | Planned nested budget CRUD and generation endpoints plus deterministic calculation service; none currently exist. |
| Persistence | `budget_items` migration exists with estimated/actual costs, paid flag, notes, category, and ordering; no repository code uses it. |
| Acceptance test | Generate a budget for a 150-person wedding, edit an estimate, mark an actual payment, verify deterministic totals and reload persistence. Unit tests must cover empty data, rounding, and invalid costs. |

### 6. Timeline and deadlines — ⚠️ Partial

| Concern | Current or planned mapping |
|---|---|
| Feature/page | `/events/:id/timeline` now supports persisted milestone creation, listing, and completion toggling. |
| Backend/service | Planned timeline CRUD/generation endpoints and overdue calculation; none currently exist. |
| Persistence | `timeline_items` migration supports due dates, status, and ordering; no code uses it. |
| Acceptance test | Generate milestones for an event six months away, complete one, add one, verify overdue status against a fixed clock, and reload to verify persistence. |

### 7. Vendor checklists and booking status — ⚠️ Partial

| Concern | Current or planned mapping |
|---|---|
| Feature/page | `/events/:id/vendors` now supports persisted vendor creation, listing, and deletion; richer booking workflows remain planned. |
| Backend/service | Planned vendor CRUD and suggestion endpoints; none currently exist. |
| Persistence | `vendors` migration supports category, contact details, quoted/final costs, notes, and `not_started → contacted → quoted → booked → paid`; no code uses it. |
| Acceptance test | Add a photographer, move it through the status workflow, verify invalid transitions/values are rejected as designed, and reload to verify persistence. |

### 8. Personalized ideas — ⚠️ Partial

| Concern | Current or planned mapping |
|---|---|
| Feature/page | `/events/:id/ideas` lists generated ideas and supports saved/dismissed states. Regeneration remains part of the next AI refinement. |
| Backend/service | Planned generation and save/dismiss endpoints with validated AI output; none currently exist. |
| Persistence | `ideas` migration supports category, title, description, estimated cost, and `new/saved/dismissed`; no code uses it. |
| Acceptance test | Generate ideas for a themed event with a budget and season, verify the output reflects those inputs, save three, dismiss two, and reload. |

### 9. Editable plans and persistent changes — 🔧

Core event title/description/date/guest/location changes have a validated `PATCH /api/events/:id` path, but there is no edit UI on the detail page and no budget/timeline/vendor/idea mutation path. Acceptance: edit each plan area, reload, and verify values persist; force a server error and verify rollback plus visible feedback.

### 10. Context-aware assistant plan changes — ❌

The database has a place for structured assistant actions, but no assistant route, context builder, response schema, action authorization, or apply endpoint exists. Acceptance: with an over-budget wedding, ask for savings, verify an action references a real budget item, require confirmation, apply it through a server-side validated mutation, and verify totals change.

## Current feature inventory

| Area | Evidence in repository | Audit result |
|---|---|---|
| Event creation | `CreateEvent.tsx`, `createEventSchema`, `POST /api/events` | Works in code path; live persistence requires Supabase credentials |
| Event listing/detail | `Dashboard.tsx`, `EventDetail.tsx`, GET routes | Implemented |
| Event deletion | Detail page and DELETE route | Implemented; uses browser `confirm` |
| Event editing | PATCH route/schema only | Partial; no UI |
| Budget/timeline/vendors/ideas/assistant | Placeholder tabs and database tables only | Missing |
| Validation | Zod body middleware and schema unit tests | Partial coverage |
| AI | No Gemini dependency, client, route, or service | Missing |
| Authentication/authorization | None | Missing; all event routes are unowned |

## Verification matrix

Every future feature must have:

1. A route/component acceptance test covering the user-visible workflow.
2. Service tests for persistence and not-found/error behavior.
3. Zod tests for valid, invalid, and boundary inputs.
4. An accessibility check for labels, focus, keyboard use, and status announcements.
5. A reload test proving database persistence rather than in-memory state.

The current executable test suite contains 39 schema tests across four files. It does not yet verify any of the ten end-to-end requirements.

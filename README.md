# EventCraft AI

> GenAI-powered event planning assistant for weddings, birthdays, and community events — with budgets, timelines, vendor checklists, and personalized ideas.

## Prerequisites

- **Node.js** 20+ (tested with v24.11)
- **npm** 10+
- **Supabase** account (free tier works) — [supabase.com](https://supabase.com)
- **Google Gemini API key** — [Google AI Studio](https://aistudio.google.com/apikey) (required for plan generation and copilot)

## Setup

```bash
# 1. Clone and install dependencies
npm install

# 2. Create environment variables
cp .env.example .env
# Edit .env with your Supabase URL, keys, Gemini API key, and optional model settings

# 3. Set up the database
# Go to your Supabase project → SQL Editor
# Paste and run the contents of: src/server/db/migrations/001_initial_schema.sql
# For an existing database, also run: src/server/db/migrations/002_phase2_event_fields.sql

# 4. Start development
npm run dev
```

This starts:
- **Frontend** on `http://localhost:5173` (Vite dev server)
- **Backend** on `http://localhost:3001` (Express API)

The Vite dev server proxies `/api` requests to the Express server.

For a production build, run `npm run build` and then `npm run server:start`. Keep
`AUTH_ENABLED=false` until authenticated event ownership and Supabase row-level
security are configured; the production API intentionally returns `503` otherwise.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend in development mode |
| `npm run dev:client` | Start only the Vite dev server |
| `npm run dev:server` | Start only the Express server (with hot-reload) |
| `npm run build` | Build for production |
| `npm run server:start` | Start the compiled production server |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Lint all source files |
| `npm run type-check` | TypeScript type checking |

## Current Project Structure

```
src/
├── client/          # React frontend (dashboard and event planning workspaces)
│   ├── features/    # Dashboard and event screens
│   ├── shared/      # UI components and API client
│   └── styles/      # Global CSS
├── server/          # Express backend
│   ├── routes/      # Event, planning, ideas, and AI API routes
│   ├── services/    # Persistence and business logic
│   ├── middleware/  # Validation and error handling
│   └── db/          # Supabase client and migration
└── shared/          # Types, Zod schemas, and constants
```

The current frontend includes an animated product landing page, a responsive planning workspace, a five-step event planning brief, editable event-scoped workspaces, an ideas studio, and an AI Copilot route. Gemini generation is server-only and optional until credentials are configured; generated plans are schema-validated before persistence.

Persistence endpoints are available under `/api/events/:eventId/{budget,timeline,vendors,ideas}`. They validate request bodies with shared Zod schemas and use Supabase-backed services. The current deployment boundary is a single-user/demo environment: authentication, ownership, and row-level security are still required before public multi-user deployment.

Production API access is intentionally disabled unless `AUTH_ENABLED=true`. Do not enable that flag until authenticated event ownership and Supabase row-level security are configured.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL via Supabase
- **AI**: Google Gemini API through the official `@google/genai` server SDK
- **Validation**: Zod (shared client/server schemas)
- **Testing**: Vitest, React Testing Library

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture documentation.
See [docs/PROBLEM_STATEMENT_ALIGNMENT.md](docs/PROBLEM_STATEMENT_ALIGNMENT.md) for the executable feature audit and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the phased plan.
See [docs/FINAL_SUBMISSION_REPORT.md](docs/FINAL_SUBMISSION_REPORT.md) for final verification evidence, limitations, and submission setup.

## License

ISC

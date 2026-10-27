# EventCraft AI

> GenAI-powered event planning assistant for weddings, birthdays, and community events — with budgets, timelines, vendor checklists, and personalized ideas.

## Prerequisites

- **Node.js** 20+ (tested with v24.11)
- **npm** 10+
- **Supabase** account (free tier works) — [supabase.com](https://supabase.com)
- **Google Gemini API key** — [Google AI Studio](https://aistudio.google.com/apikey) (required when AI modules are enabled; not used by the current event CRUD slice)

## Setup

```bash
# 1. Clone and install dependencies
npm install

# 2. Create environment variables
cp .env.example .env
# Edit .env with your Supabase URL, keys, and Gemini API key

# 3. Set up the database
# Go to your Supabase project → SQL Editor
# Paste and run the contents of: src/server/db/migrations/001_initial_schema.sql

# 4. Start development
npm run dev
```

This starts:
- **Frontend** on `http://localhost:5173` (Vite dev server)
- **Backend** on `http://localhost:3001` (Express API)

The Vite dev server proxies `/api` requests to the Express server.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend in development mode |
| `npm run dev:client` | Start only the Vite dev server |
| `npm run dev:server` | Start only the Express server (with hot-reload) |
| `npm run build` | Build for production |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Lint all source files |
| `npm run type-check` | TypeScript type checking |

## Current Project Structure

```
src/
├── client/          # React frontend (dashboard and event CRUD)
│   ├── features/    # Dashboard and event screens
│   ├── shared/      # UI components and API client
│   └── styles/      # Global CSS
├── server/          # Express backend
│   ├── routes/      # Event API routes
│   ├── services/    # Event business logic
│   ├── middleware/  # Validation and error handling
│   └── db/          # Supabase client and migration
└── shared/          # Types, Zod schemas, and constants
```

The current frontend includes a responsive application shell, a five-step event planning brief, and persistent event-scoped workspaces for budget items, timeline milestones, and vendors. Ideas and the AI assistant remain explicit placeholders until their later implementation phases; the application does not present those modules as functional.

Phase 2 persistence endpoints are available under `/api/events/:eventId/{budget,timeline,vendors}`. They validate request bodies with shared Zod schemas and use Supabase-backed services. The current deployment boundary is a single-user/demo environment: authentication, ownership, and row-level security are still required before public multi-user deployment.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL via Supabase
- **AI**: Google Gemini API (planned, server-side only; no Gemini client is implemented in the baseline)
- **Validation**: Zod (shared client/server schemas)
- **Testing**: Vitest, React Testing Library

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture documentation.
See [docs/PROBLEM_STATEMENT_ALIGNMENT.md](docs/PROBLEM_STATEMENT_ALIGNMENT.md) for the executable feature audit and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the phased plan.

## License

ISC

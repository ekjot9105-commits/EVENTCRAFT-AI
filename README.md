# EventCraft AI

> GenAI-powered event planning assistant for weddings, birthdays, and community events — with budgets, timelines, vendor checklists, and personalized ideas.

## Prerequisites

- **Node.js** 24+ (tested with v24.11; required for built-in `node:sqlite`)
- **npm** 10+
- **SQLite demo mode** requires no database account.
- **Supabase** account (optional for hosted persistence) — [supabase.com](https://supabase.com)
- **Google Gemini API key** — [Google AI Studio](https://aistudio.google.com/apikey) (optional)
- **Optional free local AI** — [Ollama](https://ollama.com/) or [LM Studio](https://lmstudio.ai/) with a downloaded model

## Setup

```bash
# 1. Clone and install dependencies
npm install

# 2. Create environment variables (SQLite works immediately)
cp .env.example .env
# AI works without credentials in local starter mode. For a free local model:
#   ollama pull llama3.2:3b
#   set AI_PROVIDER=ollama
# Add a Gemini key only when live Gemini is desired.

# 3. Set up the database
# SQLite mode creates data/eventcraft.sqlite automatically.
# Go to your Supabase project → SQL Editor
# Only for Supabase: paste and run migrations 001 through 004 in order.

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

The current frontend includes an animated product landing page, a responsive planning workspace, a five-step event planning brief, editable event-scoped workspaces, an ideas studio, and an AI Copilot route. AI generation is server-only and supports Gemini, free local Ollama/LM Studio models, and a deterministic starter mode. Every generated plan is schema-validated before persistence.

Persistence endpoints are available under `/api/events/:eventId/{budget,timeline,vendors,ideas}`. They validate request bodies with shared Zod schemas and use the configured Supabase or SQLite persistence adapter. The current deployment boundary is a single-user/demo environment: authentication, ownership, and row-level security are still required before public multi-user deployment.

Production API access is intentionally disabled unless `AUTH_ENABLED=true`. When enabled with Supabase, send a Supabase JWT and run migrations 003 and 004 for ownership and plan history. SQLite remains a local single-owner demo provider.

### Database modes

The server automatically uses the configured provider:

- `DATABASE_PROVIDER=sqlite` stores local/demo records in `SQLITE_PATH` (default: `data/eventcraft.sqlite`).
- `DATABASE_PROVIDER=supabase` uses the Supabase variables and migrations.
- If no Supabase variables exist, SQLite is selected automatically so the evaluator can exercise real create/edit/refresh workflows without fabricated data.

### AI provider modes

- `AI_PROVIDER=local` uses the built-in deterministic provider and needs no key or model download.
- `AI_PROVIDER=ollama` uses a local Ollama model. Run `ollama pull llama3.2:3b` first.
- `AI_PROVIDER=lmstudio` uses the LM Studio OpenAI-compatible local server. Set `LOCAL_AI_BASE_URL` and `LOCAL_AI_MODEL` to match the loaded model.
- `AI_PROVIDER=gemini` uses Gemini through the server-only SDK and requires `GEMINI_API_KEY`.

The local model modes are genuinely keyless, keep event data local, and fall back only when explicitly configured as `local`; they do not pretend that a deterministic response is a live model response.

SQLite uses Node 24's built-in `node:sqlite` module. Use Node 24+ for the local demo.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL via Supabase
- **AI**: Google Gemini, Ollama, LM Studio, or the built-in local provider
- **Validation**: Zod (shared client/server schemas)
- **Testing**: Vitest, React Testing Library

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture documentation.
See [docs/ENGINEERING_CONVENTIONS.md](docs/ENGINEERING_CONVENTIONS.md) for API, module, persistence, and AI boundary rules.
See [docs/PROBLEM_STATEMENT_ALIGNMENT.md](docs/PROBLEM_STATEMENT_ALIGNMENT.md) for the executable feature audit and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the phased plan.
See [docs/FINAL_SUBMISSION_REPORT.md](docs/FINAL_SUBMISSION_REPORT.md) for final verification evidence, limitations, and submission setup.

## License

ISC

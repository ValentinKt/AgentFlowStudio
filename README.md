# AgentFlowStudio

AgentFlowStudio is a local-first web app for designing, running, and monitoring multi-agent AI workflows. It provides a dashboard for agents and executions, a visual workflow builder, and a prompt analyzer that can decompose a “global prompt” into smaller tasks for specialized agents.

The app runs entirely in the browser:
- UI: React + TypeScript + Vite + Tailwind
- State: Zustand stores
- Data: an in-browser PostgreSQL-compatible database (PGlite)
- Optional AI runtime: a local Ollama instance (proxied through the Vite dev server)

## Features

- Dashboard: system status, quick overview, and activity surfaces
- Agents: create/configure agents (roles, capabilities, prompts, model config)
- Workflows: create workflows and run executions
- Analyzer: decompose a global prompt into sub-tasks (via Ollama + LangChain)
- Settings: theme + user preferences

## Local Deployment (Run Locally)

### Prerequisites
- Node.js 18+ (Vite 6)
- npm (or pnpm/yarn if you prefer — use the matching lockfile)

### Install and start the dev server
```bash
npm install
npm run dev
```

Then open the URL printed in the terminal (typically http://localhost:5173).

### Build and preview (production-like)
```bash
npm run build
npm run preview
```

### Lint and typecheck
```bash
npm run lint
npm run check
```

## Ollama (Optional, for Prompt Analyzer)

The Analyzer uses LangChain’s Ollama adapter and expects an Ollama API at `http://localhost:11434`. In development, the app calls `/ollama/*`, and the dev server proxies that to `http://localhost:11434` (see `vite.config.ts`).

1) Install Ollama and start it (example):
```bash
ollama serve
```

2) Ensure the model configured in `src/lib/ollama.ts` is available in your Ollama instance. If you change the model name, restart the dev server afterward.

If Ollama is not running, the rest of the app still loads, but Analyzer actions that require the model will fail.

## Data Model (Local-First)

On startup, the app initializes its schema in the browser (see `src/lib/db.ts`). The default system user is created automatically:
- email: `admin@crewmanager.com`
- role: `admin`

To reset local data, clear the site storage for the app origin in your browser.

## Project Structure

- `src/pages`: route-level pages (`/`, `/agents`, `/workflows`, `/analyzer`, `/settings`)
- `src/components`: UI modules (workflow designer, charts, system status, etc.)
- `src/store`: Zustand stores for agents, workflows, prompts, and notifications
- `src/lib`: local DB adapter, Ollama integration, graph factory utilities
- `prisma/`: Prisma schema and migrations (optional backend-oriented tooling)
- `supabase/`: SQL migrations and seed files (not required for local dev)

## Deployment Notes

This is a static Vite app. The production build output is `dist/`.
- Build: `npm run build`
- SPA routing: `vercel.json` rewrites all routes to `index.html`

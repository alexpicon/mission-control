# Mission Control

A local-first desktop assistant for managing many parallel projects. Tracks status,
progress, blockers, next steps; flags stale work; has an always-on-top widget, a chat
assistant over your own data, and a product-audit tool. All data lives locally in SQLite.

Product thinking lives in [`docs/working-backwards/`](docs/working-backwards/).

## Stack
Tauri v2 · React · TypeScript · Tailwind v4 · SQLite (`tauri-plugin-sql`) · Anthropic API via `tauri-plugin-http`.

## Run

```bash
npm install
npm run tauri dev        # launches the desktop app
```

Build a distributable:

```bash
npm run tauri build
```

## API key (for Chat + Audit)
The dashboard, projects, updates, widget, and stale detection all work with **no key**.
Chat and Audit need an Anthropic key:

- In-app: **Settings → paste key** (stored in the local SQLite DB, never committed), **or**
- Dev fallback: copy `.env.example` → `.env` and set `VITE_ANTHROPIC_API_KEY`.

## Project layout
```
src/
  ai/         provider (only file that calls the model), prompts, context builder
  db/         SQLite data-access layer (the only place that touches the DB)
  components/ reusable UI (cards, badges, form)
  pages/      Dashboard, ProjectDetail, Chat, Audit, Settings
  windows/    Widget (always-on-top window)
  lib/        time/staleness + widget-window control
  types/      domain types
src-tauri/    Rust shell, SQLite migrations (src/lib.rs), window + capability config
```

## Not built yet (by design)
Claude Code hooks (the `updates` table has `source` + `status` columns reserved for
approve/edit/reject), cloud sync, teams, auth, payments. See the working-backwards docs.

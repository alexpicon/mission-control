# Six-Pager — Mission Control

*Internal. Critical by design. Goal: sharpen the MVP before building.*

---

## 1. The customer
One person (start: me) running 5–15 parallel efforts: side projects, a startup, product ideas, school/grad applications, and AI coding sessions across many repos. Technical enough to run a local app and hold an API key. Not a team. Not an enterprise buyer.

**Sharpening note:** this is a *tool for one power user*, not a market yet. That's fine for a prototype but it's the central risk (see §9).

## 2. The problem
Managing many parallel projects, the failure mode is not "I forgot a task." It's:
- **Loss of situational awareness** — you can't answer "which project needs attention today?" without a slow manual mental scan.
- **Silent decay** — a project stalls for two weeks and nobody flags it.
- **Context evaporation** — especially with AI coding: fast sessions, lots changed, zero durable record of "what changed / what's next."

Existing tools solve the wrong problem. Notion = flexible but you build the system yourself and it rots. Linear/Jira = team task tracking, heavy. None track *project health* for a solo operator, and none know what your AI coding sessions did.

## 3. Why now
- Solo operators now carry team-sized workloads, amplified by AI coding tools.
- That amplification *creates* the tracking gap: more parallel work, faster, with worse memory.
- A personal API key makes a private, backend-free assistant viable today. No SaaS needed to test the idea.

## 4. The product promise
Open one window and in 5 seconds know: what you're working on, what changed, what's blocked, what's stale, and what to do next — from data you own, on your machine.

## 5. The MVP (what we build now)
1. App shell (Tauri, macOS).
2. Dashboard: project cards with status, progress, blocker, next step, last-updated, stale flag.
3. Project CRUD + detail page.
4. Local SQLite persistence.
5. Manual progress updates (a per-project timeline).
6. Floating always-on-top widget: focus project, next task, blocker.
7. Basic chat assistant over local data (local API key).
8. Basic product audit (missing pieces + best next move).

**Data model, deliberately small:** two tables — `projects` and `updates`. Everything else (decisions, blockers-over-time, notes) is just an `update` with a `kind`. No separate stores. "Stale" is *computed* from last-updated, not a stored status.

## 6. Non-goals (explicitly not building)
Team/multiplayer, cloud sync, auth, payments, screen/audio recording, calendar, mobile, autonomous agents that edit projects, a production backend, an ORM, a state-management library. Claude Code hooks are *designed for* but not built until the MVP is stable and used daily.

## 7. User workflow
- **Morning:** open app → scan dashboard → stale/blocked projects are visually flagged → pick today's focus → set it as widget focus.
- **During work:** widget stays on top showing focus + next task + blocker.
- **After a work block:** add a one-line progress update to the project. (Later: Claude Code hook proposes this update; you approve/edit/reject.)
- **When stuck:** ask chat "what's blocked across everything?" or run an audit on one project to see what's missing.

## 8. Why this is different
- **Health, not tasks.** It answers "what's dying?" not "what's on my list?"
- **Local-first and owned.** No account, no cloud, your data in a file.
- **Built for the AI-coding workflow.** The one tool designed to ingest Claude Code sessions per project (later).
- **Calm.** One window, no notifications firehose, no team noise.

## 9. Risks (honest)
- **Habit risk (biggest).** Any dashboard you must *manually* update dies in a week. If updating a project feels like a chore, the data goes stale and the tool becomes a lie. → Mitigation: keep updates one-line-fast; make the widget valuable enough to keep open; and make Claude Code auto-updates the real long-term hook. *If manual updating doesn't stick, this product doesn't work.*
- **AI-features-are-not-the-point risk.** Chat and audit are demo-friendly but not the daily driver. Over-investing in them early is a trap.
- **Market risk.** "Tool for one power user" may never generalize. Acceptable for prototype; must be revisited before any startup claim.
- **Stale-detection false comfort.** A green dashboard can be green because you stopped updating it, not because work is healthy. → The stale flag partly guards this, but it's a real failure mode.

## 10. Success metrics
Prototype is working if, after 2 weeks of personal use:
- I open it ≥5 days/week (habit).
- ≥80% of my real active projects live in it (coverage).
- The stale flag catches ≥1 genuinely-neglected project I'd have missed.
- I keep the widget open during work blocks.
Vanity metrics to ignore: number of AI chats, lines of code, feature count.

## 11. What would make this fail
- Manual updates feel like work → data rots → tool abandoned.
- We over-build AI/agent features instead of the boring daily-use core.
- The widget is annoying (steals focus, wrong info) instead of calming.
- Scope creep toward team/cloud before the solo loop is proven.

## 12. What must be true to become a real startup
- Solo operators broadly share this pain (not just me).
- The AI-coding-session integration becomes a genuine wedge no generic tool has.
- Manual-update friction is solved (largely by automation) so retention holds without discipline.
- There's a path to a trusted backend (auth, billing, key protection) once it leaves "personal prototype."
None of these are proven. The prototype exists to test #1 and the habit loop — nothing more.

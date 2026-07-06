# Press Release — Mission Control

*Internal working-backwards doc. Not marketing. Written to sharpen the product before building.*

**Date:** 2026-07-06
**Status:** Prototype / personal use

---

## Headline
Mission Control — a calm, local-first command center for people running too many projects at once.

## Subhead
See every project, what changed, what's blocked, and what's stale — in one window on your own laptop. No accounts, no cloud, no team overhead.

## The problem
People who juggle side projects, a startup, school applications, and AI coding sessions lose the thread. Progress lives in scattered places: repos, notes, memory, half-finished docs. The cost isn't forgetting a task — it's not knowing *which project is quietly dying* until it's too late. Existing tools (Notion, Linear, Trello) are built for teams and tasks, not for one person tracking the *health* of many parallel efforts.

## The product
Mission Control runs on your laptop. Every project has a status, a blocker, a next step, and a last-touched date. The dashboard shows all of them at a glance and flags the stale ones. A small always-on-top widget keeps your current focus and next task visible while you work. You can ask a local chat assistant "what's blocked?" or "what should I do next?" and it answers from your own data, in plain terms. Everything is stored locally in SQLite. You own the data.

## Why now
- Single people now run the workload that used to need a team — partly because AI coding tools multiply output across many repos at once.
- That same AI output creates a new tracking problem: sessions happen fast, context evaporates, and no tool captures "what changed and what's next" per project.
- Local LLM access via a personal API key makes a private, no-backend assistant realistic today.

## What it is not
Not a team tool. Not a task manager. Not a cloud SaaS (yet). Not an autonomous agent that edits your projects behind your back.

## Availability
Personal prototype, macOS, local-first. A published version with a real backend comes only if the prototype proves it's used daily.

## Internal quote (honest)
"The risk isn't that this is hard to build — the dashboard and CRUD are a weekend. The risk is that it becomes another dashboard I stop opening after a week. The whole bet rides on the widget + stale detection making it a daily habit, not the AI features."

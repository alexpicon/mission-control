# FAQ — Mission Control

*Internal. Answers the hard questions, not the easy ones.*

---

**Q: Why not just use Notion / Linear / a spreadsheet?**
Those track tasks for teams. This tracks *project health* for one person: what's stale, what's blocked, what needs attention today. You *could* rebuild this in Notion, but you'd maintain the system instead of the work, and it would rot. The bet is that a purpose-built, opinionated, calm view beats a flexible tool you have to assemble.

**Q: Isn't this just another dashboard I'll stop opening?**
That's the #1 risk, stated plainly. Two things guard against it: the always-on-top widget (value without opening the full app) and stale detection (it earns its keep by catching a dying project). If those don't create a habit in 2 weeks, the product has failed its core test — and we should know that rather than add features to hide it.

**Q: Why local-first instead of a cloud app?**
Speed, privacy, ownership, and zero backend to build. For a personal prototype, cloud adds cost and risk with no upside. It also forces a clean data model we own. Cloud/sync only makes sense *after* the solo loop is proven, and even then it's a "maybe."

**Q: Why my own API key instead of a real backend?**
Because building auth/billing/rate-limiting/key-protection now would be building a startup before proving anyone wants the product. The key stays in a local `.env` (git-ignored), never committed. AI calls go through one provider layer (`ai/provider`) so moving them to a backend later is a swap, not a rewrite.

**Q: What if the API key is missing?**
The app runs fully without it. Dashboard, CRUD, updates, widget, and stale detection need no AI. Chat and audit show a clear "add your API key" setup message instead of breaking.

**Q: Why are chat and audit in the MVP if they're "not the point"?**
They prove the local-data-as-context pattern works and they're cheap to build on the provider layer. But they're deliberately basic. If we catch ourselves polishing them before the daily-use core is solid, that's the trap firing.

**Q: How does the Claude Code integration work, and why isn't it in the MVP?**
Later, a Claude Code hook will POST session summaries (files changed, likely blockers, next steps) to the app, which turns them into *proposed* project updates. You approve / edit / reject — nothing touches project memory silently. It's not in the MVP because the MVP must be stable and used daily first; automation on top of an unused tool is wasted work. The data model (an `updates` table with a `kind` and a `source`) is designed now so the hook is a clean add later.

**Q: Why won't AI silently update my projects?**
Trust. If generated summaries could overwrite your memory, one bad summary poisons the data and you stop trusting the whole tool. Human-in-the-loop (approve/edit/reject) is non-negotiable for anything AI-generated.

**Q: What's the smallest possible version that's still useful?**
Dashboard + CRUD + local persistence + stale detection. That alone answers "what am I working on and what's dying." Everything else (widget, chat, audit) is additive. We build in that order so there's always a working, useful app.

**Q: What are we explicitly NOT building?**
Teams, cloud sync, auth, payments, screen/audio recording, calendars, mobile, autonomous editing agents, a production backend, an ORM, a state library. If a feature isn't proving the daily-use loop, it's cut or deferred.

**Q: When do we know to stop the prototype and either invest or kill it?**
After ~2 weeks of personal use, measured against §10 of the six-pager (open ≥5 days/week, ≥80% project coverage, stale flag catches a real miss, widget stays open). If those hold, consider whether the pain generalizes beyond me. If they don't, kill or redesign — don't add features.

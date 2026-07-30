# Master Prompts for Mission Control

Reusable prompts to paste into a **Claude Code chat inside a project**. They all
produce/maintain a checklist file that Mission Control reads. Standard filename:
`docs/mvp-checklist.md` (avoids the `MVP.md` = `mvp.md` case-collision on macOS).

The lifecycle:

1. **Kickoff** (new idea, before code) → working-backwards docs + a fresh MVP checklist (all unchecked)
2. Point Mission Control at the project (folder + `docs/mvp-checklist.md`) → 0%, goals visible
3. Build. Use **Update / Expand** to check off what's done and add the next batch
4. Ship at 100% musts → **Update / Expand** again for v2

---

## 1. Kickoff — new project, before you write code

Runs Amazon's working-backwards process, then writes the MVP checklist.

```
I'm starting a new project. Act as my critical technical cofounder and run
Amazon's working-backwards process, then produce an MVP checklist my tracker
can read. Be critical — challenge weak or too-broad ideas, name non-goals and
risks, don't rubber-stamp anything.

The idea: <describe it in 2–4 sentences>

Produce these files:
1) docs/working-backwards/press-release.md — the future press release: headline,
   the customer, the problem, the solution, why now. Honest, not marketing fluff.
2) docs/working-backwards/six-pager.md — customer, problem, why now, the MVP,
   non-goals, risks, success metrics, and what would make this fail.
3) docs/working-backwards/faq.md — the hard questions (why this, why not the
   obvious alternative, the smallest useful version, what we will NOT build yet).
4) docs/mvp-checklist.md — the build checklist, in EXACTLY this format:
   - Three headings: ## Must have, ## Should have, ## Nice to have
   - Each line "- [ ] short title" (all unchecked — nothing is built yet)
   - Must-haves = the few things truly needed to ship v1; keep it lean
   - Nothing else in that file besides the three sections and checkbox lines

Keep the MVP small and honest. Push back on scope creep. If the idea is weak or
too broad, say so and simplify before writing anything.
```

---

## 2. Initial checklist — existing project that already has code

Reads the real code and writes an honest checklist of what's done vs not.

```
Look at this project's real code and create a checklist at docs/mvp-checklist.md
describing what it needs to ship.
Rules:
- Three headings: ## Must have, ## Should have, ## Nice to have
- Each line "- [ ] short title" (not done) or "- [x] short title" (done & working)
- Only [x] things that genuinely exist and work — verify in the code, don't rubber-stamp
- Keep titles short; nothing else in the file but the three sections and checkbox lines
- Do NOT overwrite an existing file; if docs/mvp-checklist.md already exists, ask me first
```

---

## 3. Update / Expand — ongoing, and for v2

Checks off what you finished and adds the next batch of goals.

```
Update this project's checklist file (docs/mvp-checklist.md, or docs/MVP.md if
that's the one it already uses).
Rules:
- Check off [x] existing items that are now genuinely done and working; leave the rest [ ]
- ADD new items for the next version — real features/work that make it better or bigger —
  as "- [ ] short title" under the right heading (## Must have / ## Should have / ## Nice to have)
- Do NOT delete or reword existing items, and only [x] what genuinely works
- Keep titles short; nothing in the file but the three sections and checkbox lines
```

After running #2 or #3: in Mission Control, open the project → **Scan MVP file → Approve**.
Finished items credit XP; new items become your next climb.

---

## 4. Content / LinkedIn — track posts as shippable items

For a content project (e.g. the LinkedIn chat). Each checklist line is **one post**.
The rule that matters: **published = done. A written draft is NOT done.** That's what
makes finished-but-unpublished work visible instead of invisible.

```
Create a checklist at docs/mvp-checklist.md that plans my LinkedIn posts for the next
month, so my project tracker can read it and the bar fills up as I publish.

Base the topics on what I'm actually building right now — ask me what I'm working on if
you don't already know. Plan roughly 12 posts for the month, mixing:
- something I shipped or built (the strongest posts)
- something I learned, or got wrong and fixed
- a behind-the-scenes / how-I-work post
- an opinion or take on my field

Format rules:
- Three headings: ## Must have, ## Should have, ## Nice to have
- Each line is ONE post: "- [ ] short post topic" (not published) or "- [x] short post topic" (published, live on LinkedIn)
- ONLY [x] a post that is actually PUBLISHED. A written draft is NOT done.
- ## Must have = the posts I'm committing to publish this month (~8)
- ## Should have = extra ideas if I have momentum (~4)
- ## Nice to have = someday/maybe ideas
- Keep each title short — the topic, not the post text
- Keep the actual drafts in their own files (e.g. drafts/topic.md); this file is ONLY the checklist
- Do NOT delete or reword existing items; when I publish one, just check it off
- Nothing else in the file but the three sections and checkbox lines
```

Then in Mission Control: add the LinkedIn folder as a project → **Scan MVP file → Approve**.
Each published post checks off and earns XP. Re-run the prompt at the start of each month
(or when the queue runs low) to plan the next batch — same **Scan → Approve** loop as code
projects.

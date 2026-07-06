# Mission Control — MVP

This is the real build checklist for Mission Control itself, used to dogfood
evidence-based progress tracking. Checkboxes reflect actual repo state, not
aspiration. See `docs/working-backwards/` for the product rationale.

## Must have

- [x] Local desktop app shell (Tauri + React + TypeScript + Tailwind)
- [x] Project dashboard with status, blocker, next step, last-updated
- [x] Add / edit / delete projects
- [x] Project detail page
- [x] Local SQLite persistence
- [x] Floating always-on-top widget
- [x] Stale project detection
- [x] Manual progress updates (timeline)
- [x] Claude Code session tracking (hook inbox, proposed updates, approve/edit/reject)
- [x] Evidence-based progress: MVP file parsing into MVP items
- [x] Proposed scope updates when the MVP file changes (approve/edit/reject)
- [x] Folder tracking that proposes MVP item status changes (approve/edit/reject)
- [x] Setup checklist for first-run guidance
- [ ] Live end-to-end verification of evidence-based progress on a real project

## Should have

- [x] Basic chat assistant over local project data
- [x] Basic product audit (missing pieces + best next move)
- [x] AI extraction fallback for MVP files without checkbox markdown
- [ ] AI-assisted evidence matching (smarter than keyword overlap)
- [ ] Background/continuous folder watching (currently manual "Scan folder" only)

## Nice to have

- [ ] Cross-project chat ("what's blocked across everything, with evidence")
- [ ] Richer product audit using MVP item state, not just free text

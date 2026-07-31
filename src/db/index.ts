// Local SQLite data-access layer. All project/update reads and writes go through here.
// Nothing else in the app should talk to the database directly.

import Database from "@tauri-apps/plugin-sql";
import type {
  CcEvent,
  FolderSnapshotEntry,
  MvpItem,
  MvpItemStatus,
  MvpPriority,
  Project,
  ProjectInput,
  ProposedItemUpdate,
  ProposedScopeUpdate,
  ProposedUpdate,
  ShipEvent,
  UnlockedAchievement,
  Update,
  UpdateKind,
} from "../types";

let _db: Database | null = null;

async function conn(): Promise<Database> {
  if (!_db) {
    _db = await Database.load("sqlite:missioncontrol.db");
  }
  return _db;
}

// --- Projects -------------------------------------------------------------

export async function listProjects(): Promise<Project[]> {
  const db = await conn();
  return db.select<Project[]>(
    `SELECT * FROM projects ORDER BY is_focus DESC, updated_at DESC`
  );
}

export async function getProject(id: number): Promise<Project | null> {
  const db = await conn();
  const rows = await db.select<Project[]>(
    `SELECT * FROM projects WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function getFocusProject(): Promise<Project | null> {
  const db = await conn();
  const rows = await db.select<Project[]>(
    `SELECT * FROM projects WHERE is_focus = 1 LIMIT 1`
  );
  return rows[0] ?? null;
}

export async function createProject(input: ProjectInput): Promise<number> {
  const db = await conn();
  const res = await db.execute(
    `INSERT INTO projects (name, goal, status, progress, blocker, next_step, path, mvp_file_path, deadline)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.name,
      input.goal,
      input.status,
      input.progress,
      input.blocker,
      input.next_step,
      input.path,
      input.mvp_file_path,
      input.deadline,
    ]
  );
  return res.lastInsertId as number;
}

export async function updateProject(id: number, input: ProjectInput): Promise<void> {
  const db = await conn();
  // Clearing the MVP file path drops back to manual progress — evidence mode
  // only makes sense while a file is actually connected.
  const modeClause = input.mvp_file_path.trim()
    ? ""
    : `, progress_mode = 'manual'`;
  await db.execute(
    `UPDATE projects
       SET name = $1, goal = $2, status = $3, progress = $4,
           blocker = $5, next_step = $6, path = $7, mvp_file_path = $8,
           deadline = $9, updated_at = datetime('now')${modeClause}
     WHERE id = $10`,
    [
      input.name,
      input.goal,
      input.status,
      input.progress,
      input.blocker,
      input.next_step,
      input.path,
      input.mvp_file_path,
      input.deadline,
      id,
    ]
  );
}

export async function setDeadline(id: number, deadline: string): Promise<void> {
  const db = await conn();
  await db.execute(`UPDATE projects SET deadline = $1 WHERE id = $2`, [deadline, id]);
}

export async function setProgressMode(id: number, mode: "manual" | "evidence"): Promise<void> {
  const db = await conn();
  await db.execute(`UPDATE projects SET progress_mode = $1 WHERE id = $2`, [mode, id]);
}

export async function setMvpFileSeen(id: number, hash: string, mtime: string): Promise<void> {
  const db = await conn();
  await db.execute(
    `UPDATE projects SET mvp_file_hash = $1, mvp_file_mtime = $2 WHERE id = $3`,
    [hash, mtime, id]
  );
}

export async function setClaudeConnected(id: number, connected: boolean): Promise<void> {
  const db = await conn();
  await db.execute(`UPDATE projects SET claude_connected = $1 WHERE id = $2`, [
    connected ? 1 : 0,
    id,
  ]);
}

export async function deleteProject(id: number): Promise<void> {
  const db = await conn();
  // Updates are removed via ON DELETE CASCADE.
  await db.execute(`DELETE FROM projects WHERE id = $1`, [id]);
}

// Set (or clear) the single focus project shown in the widget.
export async function setFocusProject(id: number | null): Promise<void> {
  const db = await conn();
  await db.execute(`UPDATE projects SET is_focus = 0 WHERE is_focus = 1`);
  if (id !== null) {
    await db.execute(`UPDATE projects SET is_focus = 1 WHERE id = $1`, [id]);
  }
}

// --- Updates (project timeline) ------------------------------------------

export async function listUpdates(projectId: number): Promise<Update[]> {
  const db = await conn();
  return db.select<Update[]>(
    `SELECT * FROM updates WHERE project_id = $1 ORDER BY created_at DESC, id DESC`,
    [projectId]
  );
}

export async function addUpdate(
  projectId: number,
  kind: UpdateKind,
  body: string
): Promise<void> {
  const db = await conn();
  await db.execute(
    `INSERT INTO updates (project_id, kind, body, source, status)
     VALUES ($1, $2, $3, 'manual', 'accepted')`,
    [projectId, kind, body]
  );
  // Adding an update counts as touching the project (resets staleness).
  await db.execute(
    `UPDATE projects SET updated_at = datetime('now') WHERE id = $1`,
    [projectId]
  );
}

// --- Settings (key/value) -------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  const db = await conn();
  const rows = await db.select<{ value: string }[]>(
    `SELECT value FROM settings WHERE key = $1`,
    [key]
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await conn();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

// --- Claude Code events ---------------------------------------------------

export async function insertCcEvent(e: {
  session_id: string;
  project_id: number | null;
  cwd: string;
  event_name: string;
  tool_name: string;
  payload: string;
}): Promise<void> {
  const db = await conn();
  await db.execute(
    `INSERT INTO cc_events (session_id, project_id, cwd, event_name, tool_name, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [e.session_id, e.project_id, e.cwd, e.event_name, e.tool_name, e.payload]
  );
}

export async function getSessionEvents(
  projectId: number,
  sessionId: string
): Promise<CcEvent[]> {
  const db = await conn();
  return db.select<CcEvent[]>(
    `SELECT * FROM cc_events
     WHERE project_id = $1 AND session_id = $2
     ORDER BY id ASC`,
    [projectId, sessionId]
  );
}

// --- Proposed updates -----------------------------------------------------

// Returns the most recent proposed update for a (project, session), if any.
export async function findProposedForSession(
  projectId: number,
  sessionId: string
): Promise<ProposedUpdate | null> {
  const db = await conn();
  const rows = await db.select<ProposedUpdate[]>(
    `SELECT * FROM proposed_updates
     WHERE project_id = $1 AND session_id = $2
     ORDER BY id DESC LIMIT 1`,
    [projectId, sessionId]
  );
  return rows[0] ?? null;
}

export async function insertProposedUpdate(p: {
  project_id: number;
  session_id: string;
  summary: string;
  files_changed: string;
}): Promise<void> {
  const db = await conn();
  await db.execute(
    `INSERT INTO proposed_updates (project_id, session_id, summary, files_changed)
     VALUES ($1, $2, $3, $4)`,
    [p.project_id, p.session_id, p.summary, p.files_changed]
  );
}

export async function updateProposedContent(
  id: number,
  summary: string,
  filesChanged: string
): Promise<void> {
  const db = await conn();
  await db.execute(
    `UPDATE proposed_updates SET summary = $1, files_changed = $2 WHERE id = $3`,
    [summary, filesChanged, id]
  );
}

export async function setProposedStatus(
  id: number,
  status: ProposedUpdate["status"]
): Promise<void> {
  const db = await conn();
  await db.execute(`UPDATE proposed_updates SET status = $1 WHERE id = $2`, [
    status,
    id,
  ]);
}

export async function listPendingProposed(projectId: number): Promise<ProposedUpdate[]> {
  const db = await conn();
  return db.select<ProposedUpdate[]>(
    `SELECT * FROM proposed_updates
     WHERE project_id = $1 AND status = 'pending'
     ORDER BY created_at DESC, id DESC`,
    [projectId]
  );
}

export async function getProposedUpdate(id: number): Promise<ProposedUpdate | null> {
  const db = await conn();
  const rows = await db.select<ProposedUpdate[]>(
    `SELECT * FROM proposed_updates WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

// Approve: turn a proposed update into a real accepted update, then mark it approved.
export async function approveProposedUpdate(id: number): Promise<void> {
  const db = await conn();
  const proposed = await getProposedUpdate(id);
  if (!proposed) return;
  await db.execute(
    `INSERT INTO updates (project_id, kind, body, source, status)
     VALUES ($1, 'progress', $2, 'claude-code', 'accepted')`,
    [proposed.project_id, proposed.summary]
  );
  await db.execute(
    `UPDATE projects SET updated_at = datetime('now') WHERE id = $1`,
    [proposed.project_id]
  );
  await setProposedStatus(id, "approved");
}

// --- MVP items --------------------------------------------------------------

export async function listMvpItems(projectId: number): Promise<MvpItem[]> {
  const db = await conn();
  return db.select<MvpItem[]>(
    `SELECT * FROM mvp_items WHERE project_id = $1 ORDER BY
       CASE priority WHEN 'must_have' THEN 0 WHEN 'should_have' THEN 1 ELSE 2 END,
       id ASC`,
    [projectId]
  );
}

export async function insertMvpItem(item: {
  project_id: number;
  title: string;
  description: string;
  priority: MvpItem["priority"];
  source: MvpItem["source"];
}): Promise<number> {
  const db = await conn();
  const res = await db.execute(
    `INSERT INTO mvp_items (project_id, title, description, priority, status, source)
     VALUES ($1, $2, $3, $4, 'not_started', $5)`,
    [item.project_id, item.title, item.description, item.priority, item.source]
  );
  return res.lastInsertId as number;
}

export async function updateMvpItemFields(
  id: number,
  fields: { priority?: MvpItem["priority"]; description?: string }
): Promise<void> {
  const db = await conn();
  if (fields.priority !== undefined) {
    await db.execute(
      `UPDATE mvp_items SET priority = $1, updated_at = datetime('now') WHERE id = $2`,
      [fields.priority, id]
    );
  }
  if (fields.description !== undefined) {
    await db.execute(
      `UPDATE mvp_items SET description = $1, updated_at = datetime('now') WHERE id = $2`,
      [fields.description, id]
    );
  }
}

// Direct manual override — the user editing an item themselves, not an AI
// proposal, so it applies immediately with no approve/reject step.
export async function setMvpItemStatus(
  id: number,
  status: MvpItemStatus,
  evidence?: string
): Promise<void> {
  const db = await conn();
  if (evidence !== undefined) {
    await db.execute(
      `UPDATE mvp_items SET status = $1, evidence = $2, updated_at = datetime('now') WHERE id = $3`,
      [status, evidence, id]
    );
  } else {
    await db.execute(
      `UPDATE mvp_items SET status = $1, updated_at = datetime('now') WHERE id = $2`,
      [status, id]
    );
  }
}

export async function cutMvpItemByTitle(projectId: number, title: string): Promise<void> {
  const db = await conn();
  await db.execute(
    `UPDATE mvp_items SET status = 'cut', updated_at = datetime('now')
     WHERE project_id = $1 AND lower(trim(title)) = lower(trim($2)) AND status != 'cut'`,
    [projectId, title]
  );
}

// --- Proposed scope updates (from MVP file diffs) ---------------------------

export async function findScopeUpdateByHash(
  projectId: number,
  fileHash: string
): Promise<ProposedScopeUpdate | null> {
  const db = await conn();
  const rows = await db.select<ProposedScopeUpdate[]>(
    `SELECT * FROM proposed_scope_updates WHERE project_id = $1 AND file_hash = $2
     ORDER BY id DESC LIMIT 1`,
    [projectId, fileHash]
  );
  return rows[0] ?? null;
}

export async function insertScopeUpdate(u: {
  project_id: number;
  file_hash: string;
  file_mtime: string;
  diff_json: string;
  old_progress: number;
  new_progress: number;
}): Promise<void> {
  const db = await conn();
  await db.execute(
    `INSERT INTO proposed_scope_updates
       (project_id, file_hash, file_mtime, diff_json, old_progress, new_progress)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [u.project_id, u.file_hash, u.file_mtime, u.diff_json, u.old_progress, u.new_progress]
  );
}

export async function listPendingScopeUpdates(projectId: number): Promise<ProposedScopeUpdate[]> {
  const db = await conn();
  return db.select<ProposedScopeUpdate[]>(
    `SELECT * FROM proposed_scope_updates WHERE project_id = $1 AND status = 'pending'
     ORDER BY created_at DESC, id DESC`,
    [projectId]
  );
}

export async function getScopeUpdate(id: number): Promise<ProposedScopeUpdate | null> {
  const db = await conn();
  const rows = await db.select<ProposedScopeUpdate[]>(
    `SELECT * FROM proposed_scope_updates WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

export async function setScopeUpdateStatus(
  id: number,
  status: ProposedScopeUpdate["status"]
): Promise<void> {
  const db = await conn();
  await db.execute(`UPDATE proposed_scope_updates SET status = $1 WHERE id = $2`, [status, id]);
}

// --- Proposed item updates (from Claude Code / folder evidence) ------------

export async function listPendingItemUpdates(projectId: number): Promise<ProposedItemUpdate[]> {
  const db = await conn();
  return db.select<ProposedItemUpdate[]>(
    `SELECT * FROM proposed_item_updates WHERE project_id = $1 AND status = 'pending'
     ORDER BY created_at DESC, id DESC`,
    [projectId]
  );
}

// One pending proposal per MVP item at a time — new evidence merges into the
// existing pending row instead of stacking duplicates.
export async function upsertProposedItemUpdate(u: {
  project_id: number;
  mvp_item_id: number;
  suggested_status: MvpItemStatus;
  evidence: string;
  confidence: ProposedItemUpdate["confidence"];
  source: ProposedItemUpdate["source"];
  session_id: string;
}): Promise<void> {
  const db = await conn();
  const existing = await db.select<ProposedItemUpdate[]>(
    `SELECT * FROM proposed_item_updates
     WHERE project_id = $1 AND mvp_item_id = $2 AND status = 'pending'
     ORDER BY id DESC LIMIT 1`,
    [u.project_id, u.mvp_item_id]
  );
  if (existing[0]) {
    await db.execute(
      `UPDATE proposed_item_updates
         SET suggested_status = $1, evidence = $2, confidence = $3, source = $4,
             session_id = $5, created_at = datetime('now')
       WHERE id = $6`,
      [u.suggested_status, u.evidence, u.confidence, u.source, u.session_id, existing[0].id]
    );
  } else {
    await db.execute(
      `INSERT INTO proposed_item_updates
         (project_id, mvp_item_id, suggested_status, evidence, confidence, source, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        u.project_id,
        u.mvp_item_id,
        u.suggested_status,
        u.evidence,
        u.confidence,
        u.source,
        u.session_id,
      ]
    );
  }
}

// Bulk-dismiss every pending proposal for a project. These only ever suggest
// "in progress", which doesn't move any number — so clearing them is safe and
// loses nothing.
export async function rejectAllItemUpdates(projectId: number): Promise<void> {
  const db = await conn();
  await db.execute(
    `UPDATE proposed_item_updates SET status = 'rejected' WHERE project_id = $1 AND status = 'pending'`,
    [projectId]
  );
}

export async function rejectAllProposedUpdates(projectId: number): Promise<void> {
  const db = await conn();
  await db.execute(
    `UPDATE proposed_updates SET status = 'rejected' WHERE project_id = $1 AND status = 'pending'`,
    [projectId]
  );
}

export async function setItemUpdateStatus(
  id: number,
  status: ProposedItemUpdate["status"]
): Promise<void> {
  const db = await conn();
  await db.execute(`UPDATE proposed_item_updates SET status = $1 WHERE id = $2`, [status, id]);
}

export async function getItemUpdate(id: number): Promise<ProposedItemUpdate | null> {
  const db = await conn();
  const rows = await db.select<ProposedItemUpdate[]>(
    `SELECT * FROM proposed_item_updates WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

// Approve: apply the (possibly edited) status to the MVP item, then mark approved.
export async function approveItemUpdate(id: number, applyStatus: MvpItemStatus): Promise<void> {
  const proposed = await getItemUpdate(id);
  if (!proposed) return;
  await setMvpItemStatus(proposed.mvp_item_id, applyStatus, proposed.evidence);
  await setItemUpdateStatus(id, "approved");
}

// --- Folder snapshot (for scan-to-scan diffing) -----------------------------

export async function getFolderSnapshot(projectId: number): Promise<FolderSnapshotEntry[]> {
  const db = await conn();
  return db.select<FolderSnapshotEntry[]>(
    `SELECT * FROM folder_snapshot WHERE project_id = $1`,
    [projectId]
  );
}

export async function countCcEvents(): Promise<number> {
  const db = await conn();
  const rows = await db.select<{ n: number }[]>(`SELECT COUNT(*) as n FROM cc_events`);
  return rows[0]?.n ?? 0;
}

// Any proposed update (session summary, scope, or item) that the user has
// actually acted on — used only to drive the first-run setup checklist.
export async function countResolvedProposals(): Promise<number> {
  const db = await conn();
  const rows = await db.select<{ n: number }[]>(
    `SELECT
       (SELECT COUNT(*) FROM proposed_updates WHERE status != 'pending') +
       (SELECT COUNT(*) FROM proposed_scope_updates WHERE status != 'pending') +
       (SELECT COUNT(*) FROM proposed_item_updates WHERE status != 'pending') as n`
  );
  return rows[0]?.n ?? 0;
}

export async function replaceFolderSnapshot(
  projectId: number,
  files: FolderSnapshotEntry[]
): Promise<void> {
  const db = await conn();
  await db.execute(`DELETE FROM folder_snapshot WHERE project_id = $1`, [projectId]);
  for (const f of files) {
    await db.execute(
      `INSERT INTO folder_snapshot (project_id, file_path, category, hash, mtime, size)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [projectId, f.file_path, f.category, f.hash, f.mtime, f.size]
    );
  }
}

// --- Ship events + XP -------------------------------------------------------

export async function listShipEvents(): Promise<ShipEvent[]> {
  const db = await conn();
  return db.select<ShipEvent[]>(`SELECT * FROM ship_events ORDER BY id DESC`);
}

export async function listShipEventsForProject(projectId: number): Promise<ShipEvent[]> {
  const db = await conn();
  return db.select<ShipEvent[]>(
    `SELECT * FROM ship_events WHERE project_id = $1 ORDER BY id DESC`,
    [projectId]
  );
}

// Has this specific item already been shipped? Guards against double XP.
export async function hasShipEventForItem(itemId: number): Promise<boolean> {
  const db = await conn();
  const rows = await db.select<{ n: number }[]>(
    `SELECT COUNT(*) as n FROM ship_events WHERE mvp_item_id = $1`,
    [itemId]
  );
  return (rows[0]?.n ?? 0) > 0;
}

export async function insertShipEvent(e: {
  project_id: number;
  mvp_item_id: number | null;
  title: string;
  priority: MvpPriority;
  xp: number;
}): Promise<void> {
  const db = await conn();
  await db.execute(
    `INSERT INTO ship_events (project_id, mvp_item_id, title, priority, xp)
     VALUES ($1, $2, $3, $4, $5)`,
    [e.project_id, e.mvp_item_id, e.title, e.priority, e.xp]
  );
}

export async function countShipEvents(): Promise<number> {
  const db = await conn();
  const rows = await db.select<{ n: number }[]>(`SELECT COUNT(*) as n FROM ship_events`);
  return rows[0]?.n ?? 0;
}

// XP earned per project, keyed by project id — used on the dashboard cards.
export async function xpByProject(): Promise<Record<number, number>> {
  const db = await conn();
  const rows = await db.select<{ project_id: number; n: number }[]>(
    `SELECT project_id, COALESCE(SUM(xp), 0) as n FROM ship_events GROUP BY project_id`
  );
  const map: Record<number, number> = {};
  for (const r of rows) map[r.project_id] = r.n;
  return map;
}

export async function totalXp(): Promise<number> {
  const db = await conn();
  const rows = await db.select<{ n: number }[]>(
    `SELECT COALESCE(SUM(xp), 0) as n FROM ship_events`
  );
  return rows[0]?.n ?? 0;
}

export async function projectXp(projectId: number): Promise<number> {
  const db = await conn();
  const rows = await db.select<{ n: number }[]>(
    `SELECT COALESCE(SUM(xp), 0) as n FROM ship_events WHERE project_id = $1`,
    [projectId]
  );
  return rows[0]?.n ?? 0;
}

// Creates a standalone "win" item (bug fix / small shipped thing) already marked
// done, so it flows through the normal ship path. Returns the new item id.
export async function createShippedWinItem(
  projectId: number,
  title: string,
  priority: MvpPriority
): Promise<number> {
  const db = await conn();
  const res = await db.execute(
    `INSERT INTO mvp_items (project_id, title, description, priority, status, source, evidence)
     VALUES ($1, $2, '', $3, 'done', 'manual', 'Logged as a shipped win')`,
    [projectId, title, priority]
  );
  return res.lastInsertId as number;
}

// --- Achievements -----------------------------------------------------------

export async function listUnlockedAchievements(): Promise<UnlockedAchievement[]> {
  const db = await conn();
  return db.select<UnlockedAchievement[]>(`SELECT * FROM achievements_unlocked`);
}

// Insert if not already unlocked. Returns true if it was newly unlocked.
export async function unlockAchievement(key: string, projectId: number): Promise<boolean> {
  const db = await conn();
  const res = await db.execute(
    `INSERT OR IGNORE INTO achievements_unlocked (key, project_id) VALUES ($1, $2)`,
    [key, projectId]
  );
  return (res.rowsAffected ?? 0) > 0;
}

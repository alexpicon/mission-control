// Local SQLite data-access layer. All project/update reads and writes go through here.
// Nothing else in the app should talk to the database directly.

import Database from "@tauri-apps/plugin-sql";
import type {
  CcEvent,
  Project,
  ProjectInput,
  ProposedUpdate,
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
    `INSERT INTO projects (name, goal, status, progress, blocker, next_step, path)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.name,
      input.goal,
      input.status,
      input.progress,
      input.blocker,
      input.next_step,
      input.path,
    ]
  );
  return res.lastInsertId as number;
}

export async function updateProject(id: number, input: ProjectInput): Promise<void> {
  const db = await conn();
  await db.execute(
    `UPDATE projects
       SET name = $1, goal = $2, status = $3, progress = $4,
           blocker = $5, next_step = $6, path = $7, updated_at = datetime('now')
     WHERE id = $8`,
    [
      input.name,
      input.goal,
      input.status,
      input.progress,
      input.blocker,
      input.next_step,
      input.path,
      id,
    ]
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

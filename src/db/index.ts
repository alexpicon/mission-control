// Local SQLite data-access layer. All project/update reads and writes go through here.
// Nothing else in the app should talk to the database directly.

import Database from "@tauri-apps/plugin-sql";
import type { Project, ProjectInput, Update, UpdateKind } from "../types";

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
    `INSERT INTO projects (name, goal, status, progress, blocker, next_step)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.name, input.goal, input.status, input.progress, input.blocker, input.next_step]
  );
  return res.lastInsertId as number;
}

export async function updateProject(id: number, input: ProjectInput): Promise<void> {
  const db = await conn();
  await db.execute(
    `UPDATE projects
       SET name = $1, goal = $2, status = $3, progress = $4,
           blocker = $5, next_step = $6, updated_at = datetime('now')
     WHERE id = $7`,
    [input.name, input.goal, input.status, input.progress, input.blocker, input.next_step, id]
  );
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

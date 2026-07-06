// Drains the hook inbox, persists events, and (re)builds proposed updates.
// Runs on a poll while the app is open. Events written while the app was
// closed are picked up on the next drain — nothing is lost.

import { invoke } from "@tauri-apps/api/core";
import type { Project } from "../types";
import {
  listProjects,
  insertCcEvent,
  getSessionEvents,
  findProposedForSession,
  insertProposedUpdate,
  updateProposedContent,
} from "../db";
import { buildSummary } from "./summary";

// Match an event's cwd to a project by the longest stored path prefix.
function matchProject(projects: Project[], cwd: string): Project | null {
  let best: Project | null = null;
  let bestLen = -1;
  for (const p of projects) {
    if (!p.path) continue;
    const base = p.path.replace(/\/+$/, "");
    if (cwd === base || cwd.startsWith(base + "/")) {
      if (base.length > bestLen) {
        best = p;
        bestLen = base.length;
      }
    }
  }
  return best;
}

// Returns the number of raw events ingested this pass.
export async function ingestInbox(): Promise<number> {
  const raw = await invoke<string[]>("drain_cc_inbox");
  if (!raw || raw.length === 0) return 0;

  const projects = await listProjects();
  const touched = new Map<string, Project>(); // session_id -> project

  for (const line of raw) {
    let ev: any;
    try {
      ev = JSON.parse(line);
    } catch {
      continue; // ignore unparseable files
    }
    const cwd = typeof ev.cwd === "string" ? ev.cwd : "";
    const sessionId = typeof ev.session_id === "string" ? ev.session_id : "";
    const eventName =
      typeof ev.hook_event_name === "string" ? ev.hook_event_name : "";
    const toolName = typeof ev.tool_name === "string" ? ev.tool_name : "";
    const project = matchProject(projects, cwd);

    await insertCcEvent({
      session_id: sessionId,
      project_id: project ? project.id : null,
      cwd,
      event_name: eventName,
      tool_name: toolName,
      payload: line,
    });

    if (project && sessionId) touched.set(sessionId, project);
  }

  for (const [sessionId, project] of touched) {
    await refreshProposed(project, sessionId);
  }
  return raw.length;
}

async function refreshProposed(project: Project, sessionId: string): Promise<void> {
  const events = await getSessionEvents(project.id, sessionId);
  const turnEnded = events.some(
    (e) => e.event_name === "Stop" || e.event_name === "SessionEnd"
  );
  if (!turnEnded) return; // wait until a turn completes before proposing

  const existing = await findProposedForSession(project.id, sessionId);
  if (existing && existing.status !== "pending") return; // already approved/rejected

  const { summary, filesChanged } = buildSummary(project, events);
  if (existing) {
    await updateProposedContent(existing.id, summary, filesChanged);
  } else {
    await insertProposedUpdate({
      project_id: project.id,
      session_id: sessionId,
      summary,
      files_changed: filesChanged,
    });
  }
}

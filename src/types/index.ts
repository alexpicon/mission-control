// Core domain types for Mission Control.

export type Status = "Moving" | "Blocked" | "Done" | "Idea";
export const STATUSES: Status[] = ["Moving", "Blocked", "Done", "Idea"];

export interface Project {
  id: number;
  name: string;
  goal: string;
  status: Status;
  progress: number; // 0..100
  blocker: string;
  next_step: string;
  is_focus: number; // 0 | 1
  path: string; // local folder path; connects the app to a real codebase
  claude_connected: number; // 0 | 1
  created_at: string; // SQLite UTC "YYYY-MM-DD HH:MM:SS"
  updated_at: string;
}

export type UpdateKind = "progress" | "decision" | "blocker" | "note";
export const UPDATE_KINDS: UpdateKind[] = ["progress", "decision", "blocker", "note"];

export interface Update {
  id: number;
  project_id: number;
  kind: UpdateKind;
  body: string;
  source: "manual" | "claude-code"; // claude-code reserved for future hook
  status: "accepted" | "proposed" | "rejected"; // future approve/edit/reject
  created_at: string;
}

// Fields the user can edit through the project form.
export interface ProjectInput {
  name: string;
  goal: string;
  status: Status;
  progress: number;
  blocker: string;
  next_step: string;
  path: string;
}

// A proposed (not yet applied) update generated from a Claude Code session.
export interface ProposedUpdate {
  id: number;
  project_id: number;
  session_id: string;
  summary: string;
  files_changed: string; // newline-separated
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

// A raw Claude Code hook event, as persisted for summarization.
export interface CcEvent {
  id: number;
  session_id: string;
  project_id: number | null;
  cwd: string;
  event_name: string;
  tool_name: string;
  payload: string; // raw hook JSON
  created_at: string;
}

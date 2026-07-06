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
}

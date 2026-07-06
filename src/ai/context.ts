// Builds compact, plain-text context from local project data to feed the model.
// Keep it terse — the model only needs facts, not prose.

import type { Project, Update } from "../types";
import { daysSince } from "../lib/time";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function line(p: Project): string {
  const parts = [
    `[#${p.id}] ${p.name}`,
    `status: ${p.status}`,
    `progress: ${p.progress}%`,
    `last updated ${daysSince(p.updated_at)}d ago`,
    `blocker: ${p.blocker || "none"}`,
    `next: ${p.next_step || "none"}`,
  ];
  return "- " + parts.join(" | ");
}

// Full portfolio context, used by the chat assistant.
export function portfolioContext(projects: Project[]): string {
  if (projects.length === 0) {
    return `Today: ${today()}\n(No projects yet.)`;
  }
  const rows = projects.map(line).join("\n");
  return `Today: ${today()}\nPROJECTS (${projects.length}):\n${rows}`;
}

// Single-project context with recent timeline, used by chat + audit.
export function projectContext(p: Project, updates: Update[]): string {
  const recent = updates
    .slice(0, 8)
    .map((u) => `  - (${u.kind}) ${u.body}`)
    .join("\n");
  return [
    `Today: ${today()}`,
    `PROJECT: ${p.name}`,
    `Goal: ${p.goal || "(none set)"}`,
    `Status: ${p.status}`,
    `Progress: ${p.progress}%`,
    `Blocker: ${p.blocker || "none"}`,
    `Next step: ${p.next_step || "none"}`,
    `Last updated: ${daysSince(p.updated_at)} days ago`,
    updates.length ? `Recent updates:\n${recent}` : `Recent updates: none`,
  ].join("\n");
}

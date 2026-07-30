// AI "deep read" for the next best task. Optional — the deterministic picker in
// mvp/nextMove.ts always works without a key; this adds a sharper, portfolio-aware
// call plus a concrete first step.

import type { NextMove, ProjectSnapshot } from "../mvp/nextMove";
import { completeJson, MissingApiKeyError } from "./provider";
import { nextMoveSystem } from "./prompts";
import { daysSince } from "../lib/time";

// Compact, factual context — statuses and counts only, never file contents.
function buildContext(snapshots: ProjectSnapshot[]): string {
  const blocks: string[] = [];
  for (const { project, items } of snapshots) {
    if (project.status === "Done") continue;
    const active = items.filter((i) => i.status !== "cut");
    const open = active.filter((i) => i.status !== "done");
    if (open.length === 0) continue;
    const mustLeft = open.filter((i) => i.priority === "must_have").length;
    const doneCount = active.length - open.length;

    const lines = open
      .slice(0, 25)
      .map((i) => `  - [${i.priority}] [${i.status}] ${i.title}`)
      .join("\n");

    blocks.push(
      [
        `PROJECT ${project.id}: ${project.name}`,
        `  done: ${doneCount}/${active.length} | must-haves left: ${mustLeft} | last touched ${daysSince(project.updated_at)}d ago`,
        `  open tasks:`,
        lines,
      ].join("\n")
    );
  }
  return blocks.join("\n\n");
}

interface RawMove {
  projectId?: unknown;
  title?: unknown;
  reason?: unknown;
  firstStep?: unknown;
}

// Returns null if there's no key, the model fails, or it names a task that
// doesn't exist — callers fall back to the deterministic pick rather than
// showing anything invented.
export async function aiNextMove(snapshots: ProjectSnapshot[]): Promise<NextMove | null> {
  const context = buildContext(snapshots);
  if (!context.trim()) return null;

  try {
    const raw = await completeJson<RawMove>({
      system: nextMoveSystem(),
      messages: [{ role: "user", content: context }],
      maxTokens: 400,
    });

    const projectId = Number(raw.projectId);
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!projectId || !title) return null;

    // Validate against real data — the model must have picked an actual task.
    const snap = snapshots.find((s) => s.project.id === projectId);
    if (!snap) return null;
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    const item = snap.items.find(
      (i) => norm(i.title) === norm(title) && i.status !== "done" && i.status !== "cut"
    );
    if (!item) return null;

    return {
      projectId,
      projectName: snap.project.name,
      itemId: item.id,
      title: item.title,
      priority: item.priority,
      reason: typeof raw.reason === "string" ? raw.reason : "",
      firstStep: typeof raw.firstStep === "string" ? raw.firstStep : undefined,
      source: "ai",
    };
  } catch (e) {
    if (e instanceof MissingApiKeyError) return null;
    return null;
  }
}

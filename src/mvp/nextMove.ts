// Picks the single best TASK to work on next, across every project.
//
// Deterministic and explainable — no AI needed. The scoring is deliberately
// biased toward FINISHING what's nearly done, because the failure mode this
// app exists to fix is "many things started, nothing shipped".

import type { MvpItem, MvpPriority, Project } from "../types";
import { listMvpItems } from "../db";
import { isStale } from "../lib/time";

export interface NextMove {
  projectId: number;
  projectName: string;
  itemId: number;
  title: string;
  priority: MvpPriority;
  reason: string;
  firstStep?: string; // only the AI take fills this in
  source: "auto" | "ai";
}

export interface ProjectSnapshot {
  project: Project;
  items: MvpItem[];
}

export async function loadSnapshots(projects: Project[]): Promise<ProjectSnapshot[]> {
  const out: ProjectSnapshot[] = [];
  for (const project of projects) {
    out.push({ project, items: await listMvpItems(project.id) });
  }
  return out;
}

const PRIORITY_SCORE: Record<MvpPriority, number> = {
  must_have: 100,
  should_have: 40,
  nice_to_have: 10,
};

function reasonFor(
  project: Project,
  item: MvpItem,
  remainingMust: number,
  stale: boolean
): string {
  const parts: string[] = [];

  if (item.priority === "must_have" && remainingMust === 1) {
    parts.push(`Last must-have in ${project.name} — finish it and the MVP is done.`);
  } else if (item.status === "in_progress") {
    parts.push(`Already in progress in ${project.name}.`);
    if (remainingMust > 0) parts.push(`${remainingMust} must-haves left.`);
  } else if (item.priority === "must_have") {
    parts.push(`Top unfinished must-have in ${project.name}.`);
    parts.push(`${remainingMust} left before it ships.`);
  } else {
    parts.push(`All must-haves in ${project.name} are done — this is the next best add-on.`);
  }

  if (item.status === "blocked") parts.push("Marked blocked — unblock it or pick it apart.");
  if (stale) parts.push("This project has gone quiet.");
  return parts.join(" ");
}

// Returns the best task overall, or null if there's nothing actionable.
export function pickNextMove(snapshots: ProjectSnapshot[]): NextMove | null {
  let best: NextMove | null = null;
  let bestScore = -Infinity;

  for (const { project, items } of snapshots) {
    if (project.status === "Done") continue;
    const active = items.filter((i) => i.status !== "cut");
    const remainingMust = active.filter(
      (i) => i.priority === "must_have" && i.status !== "done"
    ).length;
    const stale = isStale(project);

    for (const item of active) {
      if (item.status === "done") continue;

      let score = PRIORITY_SCORE[item.priority];
      if (item.status === "in_progress") score += 50; // finish what you started
      if (item.status === "blocked") score -= 60; // can't move it right now
      // Finish-line bias: the closer a project is to shipping, the more its
      // remaining must-haves are worth.
      if (item.priority === "must_have" && remainingMust > 0) {
        score += Math.round(60 / remainingMust);
      }
      if (stale) score += 10; // nudge quiet projects back to life

      if (score > bestScore) {
        bestScore = score;
        best = {
          projectId: project.id,
          projectName: project.name,
          itemId: item.id,
          title: item.title,
          priority: item.priority,
          reason: reasonFor(project, item, remainingMust, stale),
          source: "auto",
        };
      }
    }
  }

  return best;
}

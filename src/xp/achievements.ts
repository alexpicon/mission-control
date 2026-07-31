// Achievement definitions + pure evaluation. Everything here rewards
// FINISHING, not activity — that's the whole point of the system for someone
// who starts a lot and ships little.

import type { MvpItem, ShipEvent } from "../types";

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  // true = can be earned once per project (project_id set); false = global.
  perProject: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_ship", title: "First Ship", description: "Ship your first thing.", perProject: false },
  { key: "momentum", title: "Momentum", description: "Ship 5 things.", perProject: false },
  { key: "closer", title: "Closer", description: "Ship 25 things.", perProject: false },
  {
    key: "multi_threader",
    title: "Multi-Threader",
    description: "Ship something in 3 different projects.",
    perProject: false,
  },
  {
    key: "shipped_it",
    title: "Shipped It",
    description: "Finish every must-have in a project.",
    perProject: true,
  },
  {
    key: "revival",
    title: "Revival",
    description: "Ship in a project that had gone stale.",
    perProject: true,
  },
  {
    key: "beat_the_clock",
    title: "Beat the Clock",
    description: "Finish every must-have before the target date.",
    perProject: true,
  },
];

export const ACHIEVEMENTS_BY_KEY: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.key, a])
);

// State needed to evaluate every rule, gathered by the caller (no I/O here).
export interface AchievementContext {
  allShipEvents: ShipEvent[]; // every ship across all projects (append-only)
  projectId: number; // the project just shipped into
  projectItems: MvpItem[]; // current mvp_items for that project (post-ship)
  projectWasStale: boolean; // was this project stale at the moment of shipping?
  beforeDeadline: boolean; // project has a target date and it hasn't passed
}

// An unlock is identified by (key, project_id). Global achievements use
// project_id 0; per-project ones use the real id.
export interface AchievementUnlock {
  key: string;
  project_id: number;
}

// Returns every achievement the current state satisfies. The caller diffs this
// against what's already unlocked and only celebrates the new ones — so this
// stays a pure "what is currently true" function.
export function evaluateAchievements(ctx: AchievementContext): AchievementUnlock[] {
  const unlocks: AchievementUnlock[] = [];
  const totalShips = ctx.allShipEvents.length;

  if (totalShips >= 1) unlocks.push({ key: "first_ship", project_id: 0 });
  if (totalShips >= 5) unlocks.push({ key: "momentum", project_id: 0 });
  if (totalShips >= 25) unlocks.push({ key: "closer", project_id: 0 });

  const distinctProjects = new Set(ctx.allShipEvents.map((e) => e.project_id));
  if (distinctProjects.size >= 3) unlocks.push({ key: "multi_threader", project_id: 0 });

  // "Shipped It": every must-have in this project is done (and there's at least one).
  const must = ctx.projectItems.filter((i) => i.priority === "must_have" && i.status !== "cut");
  const allMustDone = must.length > 0 && must.every((i) => i.status === "done");
  if (allMustDone) {
    unlocks.push({ key: "shipped_it", project_id: ctx.projectId });
    // Rewarding beating the date — the research is clear that rewards
    // motivate far more than the threat of missing one.
    if (ctx.beforeDeadline) {
      unlocks.push({ key: "beat_the_clock", project_id: ctx.projectId });
    }
  }

  if (ctx.projectWasStale) {
    unlocks.push({ key: "revival", project_id: ctx.projectId });
  }

  return unlocks;
}

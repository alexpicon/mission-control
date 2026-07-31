// Suggests a target date from the work that's actually left.
//
// Deliberately aggressive: one must-have per day. That's a hard pace, which is
// the point — the pressure is the feature. But it's derived from real remaining
// scope rather than plucked from the air, so the date is defensible: if it says
// four days, that's four must-haves. Cutting scope moves the date honestly.
//
// Guards: never suggests "tomorrow" (a date you've already lost on arrival),
// and never suggests anything for a project with nothing left to do.

import type { Project } from "../types";
import type { MvpProgress } from "../mvp/diff";

/** Must-haves per day. Higher = harsher. */
export const PACE_PER_DAY = 1;

/** Floor, so a fresh deadline is never impossible the moment it's set. */
const MIN_DAYS = 2;

export interface DeadlineSuggestion {
  date: string; // 'YYYY-MM-DD'
  days: number;
  remaining: number;
  reason: string;
}

function isoInDays(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Returns null when there's nothing to pace against — a finished project, or
// one with no MVP items yet. We never invent a date out of nothing.
export function suggestDeadline(
  project: Project,
  progress: MvpProgress | undefined
): DeadlineSuggestion | null {
  if (project.status === "Done") return null;
  if (!progress || progress.totalMust === 0) return null;

  const remaining = progress.totalMust - progress.doneMust;
  if (remaining <= 0) return null;

  const days = Math.max(MIN_DAYS, Math.ceil(remaining / PACE_PER_DAY));

  return {
    date: isoInDays(days),
    days,
    remaining,
    reason: `${remaining} must-have${remaining === 1 ? "" : "s"} left · ${PACE_PER_DAY}/day pace`,
  };
}

// Suggestions for every project that doesn't already have a date. Existing
// dates are never overwritten — once you've committed to one, it's yours.
export function suggestForAll(
  projects: Project[],
  progressMap: Record<number, MvpProgress>
): { project: Project; suggestion: DeadlineSuggestion }[] {
  const out: { project: Project; suggestion: DeadlineSuggestion }[] = [];
  for (const project of projects) {
    if (project.deadline.trim()) continue;
    const suggestion = suggestDeadline(project, progressMap[project.id]);
    if (suggestion) out.push({ project, suggestion });
  }
  return out;
}

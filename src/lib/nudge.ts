// Picks ONE nudge to show. Deliberately one — the research is consistent that
// a wall of reminders gets tuned out, while a single specific, action-oriented
// prompt lands. Every nudge names a real project and a real next task.
//
// Tone rules, applied throughout:
//   - State facts, never blame. "2 days past due" — not "you missed this".
//   - Always give the next concrete action, so there's no thinking required.
//   - Offer the escape hatch (move the date) rather than implying failure.

import type { Project } from "../types";
import type { MvpProgress } from "../mvp/diff";
import type { NextMove } from "../mvp/nextMove";
import { daysUntil } from "./deadline";
import { isStale, daysSince } from "./time";

export type NudgeTone = "urgent" | "close" | "quiet";

export interface Nudge {
  projectId: number;
  tone: NudgeTone;
  headline: string;
  action: string; // the concrete next task
  /** True when the deadline has passed — the UI offers to move the date. */
  offerReschedule: boolean;
}

export function pickNudge(
  projects: Project[],
  mvpProgress: Record<number, MvpProgress>,
  movesByProject: Record<number, NextMove>
): Nudge | null {
  const live = projects.filter((p) => p.status !== "Done");
  const nextOf = (p: Project) => movesByProject[p.id]?.title ?? p.next_step ?? "";
  const mustLeft = (p: Project) => {
    const prog = mvpProgress[p.id];
    if (!prog) return null;
    return prog.totalMust - prog.doneMust;
  };

  // 1) Past its date, with work still open. Most time-pressured — but framed as
  //    a fact plus a choice, never a scolding.
  const overdue = live
    .filter((p) => {
      const d = daysUntil(p.deadline);
      return d !== null && d < 0 && (mustLeft(p) ?? 1) > 0;
    })
    .sort((a, b) => (daysUntil(a.deadline) ?? 0) - (daysUntil(b.deadline) ?? 0))[0];

  if (overdue) {
    const late = Math.abs(daysUntil(overdue.deadline)!);
    const left = mustLeft(overdue);
    return {
      projectId: overdue.id,
      tone: "urgent",
      headline:
        left !== null
          ? `${overdue.name} passed its date ${late === 1 ? "yesterday" : `${late} days ago`} — ${left} must-have${left === 1 ? "" : "s"} left.`
          : `${overdue.name} passed its date ${late === 1 ? "yesterday" : `${late} days ago`}.`,
      action: nextOf(overdue),
      offerReschedule: true,
    };
  }

  // 2) Due today or within three days, still unfinished.
  const soon = live
    .filter((p) => {
      const d = daysUntil(p.deadline);
      return d !== null && d >= 0 && d <= 3 && (mustLeft(p) ?? 1) > 0;
    })
    .sort((a, b) => (daysUntil(a.deadline) ?? 0) - (daysUntil(b.deadline) ?? 0))[0];

  if (soon) {
    const d = daysUntil(soon.deadline)!;
    const when = d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
    return {
      projectId: soon.id,
      tone: "urgent",
      headline: `${soon.name} is due ${when}.`,
      action: nextOf(soon),
      offerReschedule: false,
    };
  }

  // 3) One must-have from shipping. The highest-leverage nudge there is —
  //    finishing beats starting, and this is the shortest path to a ship.
  const nearlyDone = live
    .filter((p) => mustLeft(p) === 1)
    .sort((a, b) => daysSince(b.updated_at) - daysSince(a.updated_at))[0];

  if (nearlyDone) {
    return {
      projectId: nearlyDone.id,
      tone: "close",
      headline: `${nearlyDone.name} is one must-have from shipping.`,
      action: nextOf(nearlyDone),
      offerReschedule: false,
    };
  }

  // 4) Something has gone quiet. Surfaced without guilt — just visibility.
  const quiet = live
    .filter(isStale)
    .sort((a, b) => daysSince(b.updated_at) - daysSince(a.updated_at))[0];

  if (quiet) {
    return {
      projectId: quiet.id,
      tone: "quiet",
      headline: `${quiet.name} has been quiet for ${daysSince(quiet.updated_at)} days.`,
      action: nextOf(quiet),
      offerReschedule: false,
    };
  }

  return null;
}

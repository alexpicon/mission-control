// Progress calculation and MVP-file diffing. Every rule here mirrors the
// product spec directly — no "vibes":
//   - Core MVP progress = done must-haves / active (non-cut) must-haves.
//   - Cut items never count in the denominator.
//   - Nice-to-haves never inflate core progress; shown separately.
//   - In-progress items are visible but do not count as done.
//   - If scope grows (more must-haves), progress can go down.

import type { MvpItem, MvpScopeDiff, ParsedMvpItem } from "../types";

export interface MvpProgress {
  pct: number; // 0..100, core MVP progress (must-haves only)
  doneMust: number;
  totalMust: number;
  inProgress: MvpItem[];
  blocked: MvpItem[];
  missingMust: MvpItem[]; // not_started must-haves
  should: { done: number; total: number };
  nice: { done: number; total: number };
}

export function computeMvpProgress(items: MvpItem[]): MvpProgress {
  const active = items.filter((i) => i.status !== "cut");
  const must = active.filter((i) => i.priority === "must_have");
  const should = active.filter((i) => i.priority === "should_have");
  const nice = active.filter((i) => i.priority === "nice_to_have");

  const doneMust = must.filter((i) => i.status === "done").length;
  const pct = must.length ? Math.round((doneMust / must.length) * 100) : 0;

  return {
    pct,
    doneMust,
    totalMust: must.length,
    inProgress: active.filter((i) => i.status === "in_progress"),
    blocked: active.filter((i) => i.status === "blocked"),
    missingMust: must.filter((i) => i.status === "not_started"),
    should: { done: should.filter((i) => i.status === "done").length, total: should.length },
    nice: { done: nice.filter((i) => i.status === "done").length, total: nice.length },
  };
}

function norm(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

// Diff a freshly parsed MVP file against the items already stored for a
// project. Matching is by normalized title. Nothing here mutates the
// database — it's a pure comparison used to build a proposed scope update.
export function diffMvpItems(current: MvpItem[], parsed: ParsedMvpItem[], usedAi: boolean): MvpScopeDiff {
  const activeCurrent = current.filter((i) => i.status !== "cut");
  const currentByTitle = new Map(activeCurrent.map((i) => [norm(i.title), i]));
  const parsedByTitle = new Map(parsed.map((p) => [norm(p.title), p]));

  const added: ParsedMvpItem[] = [];
  const changed: MvpScopeDiff["changed"] = [];

  for (const p of parsed) {
    const existing = currentByTitle.get(norm(p.title));
    if (!existing) {
      added.push(p);
    } else if (existing.priority !== p.priority) {
      changed.push({
        title: p.title,
        before: { priority: existing.priority },
        after: { priority: p.priority },
      });
    }
  }

  const removed: MvpScopeDiff["removed"] = [];
  for (const c of activeCurrent) {
    if (!parsedByTitle.has(norm(c.title))) {
      removed.push({ title: c.title, priority: c.priority });
    }
  }

  return { added, removed, changed, usedAi };
}

// Simulates the effect of applying a scope diff, for computing the "progress
// impact" shown before approval. Purely in-memory — does not touch the DB.
export function simulateApply(current: MvpItem[], diff: MvpScopeDiff): MvpItem[] {
  const removedTitles = new Set(diff.removed.map((r) => norm(r.title)));
  const changedByTitle = new Map(diff.changed.map((c) => [norm(c.title), c]));

  const simulated: MvpItem[] = current.map((item) => {
    const key = norm(item.title);
    if (removedTitles.has(key)) return { ...item, status: "cut" };
    const change = changedByTitle.get(key);
    if (change) return { ...item, priority: change.after.priority };
    return item;
  });

  for (const a of diff.added) {
    simulated.push({
      id: -1,
      project_id: current[0]?.project_id ?? -1,
      title: a.title,
      description: a.description,
      priority: a.priority,
      status: "not_started",
      evidence: "",
      confidence: "low",
      source: diff.usedAi ? "ai_extracted" : "mvp_file",
      created_at: "",
      updated_at: "",
    });
  }

  return simulated;
}

export function hasMeaningfulDiff(diff: MvpScopeDiff): boolean {
  return diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;
}

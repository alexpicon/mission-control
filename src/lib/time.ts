// Time + staleness helpers.
// SQLite datetime('now') returns UTC as "YYYY-MM-DD HH:MM:SS" (no timezone marker),
// so we append "Z" to parse it as UTC rather than local time.

import type { Project } from "../types";

// A project counts as stale after this many days without an update.
// Matches the product spec example ("not touched in 6 days" reads as stale).
export const STALE_DAYS = 5;

export function parseSqliteUtc(s: string): Date {
  return new Date(s.replace(" ", "T") + "Z");
}

export function daysSince(iso: string): number {
  const then = parseSqliteUtc(iso).getTime();
  const diff = Date.now() - then;
  return Math.floor(diff / 86_400_000);
}

export function relativeTime(iso: string): string {
  const d = daysSince(iso);
  if (d <= 0) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

// Stale only applies to work that is supposed to be moving.
// Done = finished, Idea = intentionally parked. Neither goes stale.
export function isStale(p: Project): boolean {
  if (p.status === "Done" || p.status === "Idea") return false;
  return daysSince(p.updated_at) >= STALE_DAYS;
}

export function staleLabel(p: Project): string | null {
  if (!isStale(p)) return null;
  return `Stale: not touched in ${daysSince(p.updated_at)} days`;
}

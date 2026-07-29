// Pure XP math. No I/O — easy to unit-test and reason about.
//
// XP is earned only by SHIPPING (an item going done / a logged win). Weights
// reward finishing the things that actually make a product real.

import type { MvpPriority } from "../types";

export const XP_WEIGHTS: Record<MvpPriority, number> = {
  must_have: 50,
  should_have: 25,
  nice_to_have: 10,
};

// A logged "win" (bug fix / small shipped thing that wasn't a planned item)
// defaults to this when the user doesn't pick a priority.
export const DEFAULT_WIN_XP = 15;

export function xpForPriority(priority: MvpPriority): number {
  return XP_WEIGHTS[priority];
}

// Cumulative XP required to REACH a given level (triangular curve):
//   L1=0, L2=50, L3=150, L4=300, L5=500, L6=750, ...
// Early levels come fast (first must-have -> level 2), then ramp.
export function xpToReachLevel(level: number): number {
  if (level <= 1) return 0;
  return 25 * level * (level - 1);
}

export function levelForXp(totalXp: number): number {
  if (totalXp <= 0) return 1;
  let level = 1;
  while (xpToReachLevel(level + 1) <= totalXp) level++;
  return level;
}

export interface LevelInfo {
  level: number;
  totalXp: number;
  xpIntoLevel: number; // XP earned since reaching the current level
  xpForNextLevel: number; // XP span of the current level
  pctToNext: number; // 0..100 progress toward next level
}

export function levelInfo(totalXp: number): LevelInfo {
  const level = levelForXp(totalXp);
  const floor = xpToReachLevel(level);
  const ceil = xpToReachLevel(level + 1);
  const span = ceil - floor;
  const into = totalXp - floor;
  return {
    level,
    totalXp,
    xpIntoLevel: into,
    xpForNextLevel: span,
    pctToNext: span > 0 ? Math.round((into / span) * 100) : 100,
  };
}

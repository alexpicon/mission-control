// Loads the portfolio-wide XP/level snapshot for the sidebar and achievements.

import type { UnlockedAchievement } from "../types";
import { listUnlockedAchievements, totalXp } from "../db";
import { levelInfo, type LevelInfo } from "./model";

export interface XpSummary {
  level: LevelInfo;
  unlocked: UnlockedAchievement[];
}

export async function loadXpSummary(): Promise<XpSummary> {
  const [xp, unlocked] = await Promise.all([totalXp(), listUnlockedAchievements()]);
  return { level: levelInfo(xp), unlocked };
}

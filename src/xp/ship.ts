// Shipping orchestration. This is the ONLY place that turns "an item is done"
// into XP + achievements. Everything that ships a thing (the Ship-it button, a
// logged win, an auto-detected MVP-file checkbox) goes through here so the
// rules stay in one place.

import type { MvpItem, MvpPriority, Project, ShipResult } from "../types";
import { isStale } from "../lib/time";
import { daysUntil } from "../lib/deadline";
import { xpForPriority, levelForXp } from "./model";
import { evaluateAchievements } from "./achievements";
import {
  createShippedWinItem,
  hasShipEventForItem,
  insertShipEvent,
  listMvpItems,
  listShipEvents,
  setMvpItemStatus,
  totalXp,
  unlockAchievement,
} from "../db";

async function evaluateAndUnlock(project: Project, wasStale: boolean): Promise<string[]> {
  const [allShipEvents, projectItems] = await Promise.all([
    listShipEvents(),
    listMvpItems(project.id),
  ]);
  const days = daysUntil(project.deadline);
  const unlocks = evaluateAchievements({
    allShipEvents,
    projectId: project.id,
    projectItems,
    projectWasStale: wasStale,
    beforeDeadline: days !== null && days >= 0,
  });
  const newly: string[] = [];
  for (const u of unlocks) {
    if (await unlockAchievement(u.key, u.project_id)) newly.push(u.key);
  }
  return newly;
}

// Award XP for an item exactly once (first ship). Later re-ships of the same
// item are idempotent — they never double-award.
async function recordShip(
  project: Project,
  itemId: number,
  title: string,
  priority: MvpPriority,
  wasStale: boolean
): Promise<{ shipped: boolean; xpAwarded: number; newAchievements: string[] }> {
  const already = await hasShipEventForItem(itemId);
  let xpAwarded = 0;
  if (!already) {
    xpAwarded = xpForPriority(priority);
    await insertShipEvent({
      project_id: project.id,
      mvp_item_id: itemId,
      title,
      priority,
      xp: xpAwarded,
    });
  }
  const newAchievements = await evaluateAndUnlock(project, wasStale);
  return { shipped: !already, xpAwarded, newAchievements };
}

function buildResult(
  title: string,
  core: { shipped: boolean; xpAwarded: number; newAchievements: string[] },
  before: number,
  after: number
): ShipResult {
  const levelBefore = levelForXp(before);
  const levelAfter = levelForXp(after);
  return {
    shipped: core.shipped,
    xpAwarded: core.xpAwarded,
    title,
    totalXpBefore: before,
    totalXpAfter: after,
    levelBefore,
    levelAfter,
    leveledUp: levelAfter > levelBefore,
    newAchievements: core.newAchievements,
  };
}

// Ship an existing MVP item (from the "Ship it" button or an auto-detected
// checkbox flip). Marks it done and awards XP the first time.
export async function shipMvpItem(item: MvpItem, project: Project): Promise<ShipResult> {
  const wasStale = isStale(project);
  const before = await totalXp();
  await setMvpItemStatus(item.id, "done");
  const core = await recordShip(project, item.id, item.title, item.priority, wasStale);
  const after = await totalXp();
  return buildResult(item.title, core, before, after);
}

// Log a shipped "win" that wasn't a planned item (a bug fix, a small thing).
// Mints a done item and ships it — always awards, since it's brand new.
export async function logShippedWin(
  project: Project,
  title: string,
  priority: MvpPriority
): Promise<ShipResult> {
  const wasStale = isStale(project);
  const before = await totalXp();
  const itemId = await createShippedWinItem(project.id, title.trim(), priority);
  const core = await recordShip(project, itemId, title.trim(), priority, wasStale);
  const after = await totalXp();
  return buildResult(title.trim(), core, before, after);
}

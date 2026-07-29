import type { UnlockedAchievement } from "../types";
import { ACHIEVEMENTS } from "../xp/achievements";

// Shows all achievements, earned ones highlighted. Locked ones stay visible
// (with how-to) so there's always a next goal in sight.
export function Achievements({
  unlocked,
  projectId,
}: {
  unlocked: UnlockedAchievement[];
  projectId?: number; // when set, per-project achievements resolve for this project
}) {
  const isEarned = (key: string, perProject: boolean) =>
    unlocked.some(
      (u) => u.key === key && (perProject ? u.project_id === projectId : u.project_id === 0)
    );

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-zinc-900">Achievements</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ACHIEVEMENTS.map((a) => {
          const earned = isEarned(a.key, a.perProject);
          return (
            <div
              key={a.key}
              className={`flex items-start gap-2 rounded-lg border p-2 ${
                earned ? "border-violet-200 bg-violet-50/50" : "border-zinc-100 bg-zinc-50"
              }`}
            >
              <span className={earned ? "" : "opacity-30"} aria-hidden>
                🏆
              </span>
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${earned ? "text-zinc-900" : "text-zinc-400"}`}
                >
                  {a.title}
                </p>
                <p className={`text-xs ${earned ? "text-zinc-500" : "text-zinc-400"}`}>
                  {a.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import type { LevelInfo } from "../xp/model";

// Always-visible portfolio level + XP-to-next bar. One number that goes up as
// you ship across ALL projects — the antidote to "I juggle everything and
// finish nothing".
export function LevelBadge({ level }: { level: LevelInfo }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-zinc-900">Level {level.level}</span>
        <span className="text-xs tabular-nums text-zinc-400">{level.totalXp} XP</span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100"
        role="progressbar"
        aria-valuenow={level.pctToNext}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress to next level"
      >
        <div
          className="h-full rounded-full bg-emerald-600 transition-all duration-500"
          style={{ width: `${level.pctToNext}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-zinc-400">
        {level.xpForNextLevel - level.xpIntoLevel} XP to level {level.level + 1}
      </p>
    </div>
  );
}

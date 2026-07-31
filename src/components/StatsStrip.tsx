import type { LevelInfo } from "../xp/model";

interface Stat {
  label: string;
  value: string | number;
  sub?: string;
  accent: string; // gradient for the value
  tint: string; // card background tint
}

// The at-a-glance row. Gives the dashboard something to look at the moment it
// opens, and puts the numbers that actually move — level, things shipped, what's
// on the clock — above the fold instead of buried in cards.
export function StatsStrip({
  level,
  shipped,
  dueSoon,
  stale,
  activeCount,
}: {
  level: LevelInfo;
  shipped: number;
  dueSoon: number;
  stale: number;
  activeCount: number;
}) {
  const stats: Stat[] = [
    {
      label: "Level",
      value: level.level,
      sub: `${level.xpForNextLevel - level.xpIntoLevel} XP to ${level.level + 1}`,
      accent: "from-emerald-500 to-teal-500",
      tint: "from-emerald-50/70",
    },
    {
      label: "Shipped",
      value: shipped,
      sub: `${level.totalXp} XP total`,
      accent: "from-violet-500 to-fuchsia-500",
      tint: "from-violet-50/70",
    },
    {
      label: "Active",
      value: activeCount,
      sub: "projects in flight",
      accent: "from-sky-500 to-blue-500",
      tint: "from-sky-50/70",
    },
    {
      label: "On the clock",
      value: dueSoon,
      sub: dueSoon === 0 ? "nothing due soon" : "due within 3 days",
      accent: dueSoon > 0 ? "from-rose-500 to-orange-500" : "from-zinc-400 to-zinc-500",
      tint: dueSoon > 0 ? "from-rose-50/70" : "from-zinc-50",
    },
    {
      label: "Quiet",
      value: stale,
      sub: stale === 0 ? "all recently touched" : "not touched lately",
      accent: stale > 0 ? "from-amber-500 to-orange-500" : "from-zinc-400 to-zinc-500",
      tint: stale > 0 ? "from-amber-50/70" : "from-zinc-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((s) => (
        <div
          key={s.label}
          className={`rounded-2xl border border-zinc-200 bg-gradient-to-br ${s.tint} to-white p-3.5 shadow-sm`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            {s.label}
          </p>
          <p
            className={`mt-0.5 bg-gradient-to-br ${s.accent} bg-clip-text text-3xl font-bold leading-none tabular-nums text-transparent`}
          >
            {s.value}
          </p>
          {s.sub && <p className="mt-1 text-[11px] text-zinc-500">{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}

import type { Project } from "../types";
import type { MvpProgress } from "../mvp/diff";
import type { NextMove } from "../mvp/nextMove";
import { ProjectCard } from "../components/ProjectCard";
import { SetupChecklist } from "../components/SetupChecklist";
import { NudgeBar } from "../components/NudgeBar";
import type { Nudge } from "../lib/nudge";
import { urgencyRank, daysUntil } from "../lib/deadline";
import { StatsStrip } from "../components/StatsStrip";
import type { LevelInfo } from "../xp/model";
import { isStale } from "../lib/time";

export function Dashboard({
  projects,
  mvpProgress,
  movesByProject,
  nudge,
  level,
  shipped,
  xpByProjectMap,
  onSetDeadlines,
  onReschedule,
  onDismissNudge,
  onOpen,
  onNewProject,
}: {
  projects: Project[];
  mvpProgress: Record<number, MvpProgress>;
  movesByProject: Record<number, NextMove>;
  nudge: Nudge | null;
  level: LevelInfo;
  shipped: number;
  xpByProjectMap: Record<number, number>;
  onSetDeadlines: () => void;
  onReschedule: (id: number) => void;
  onDismissNudge: () => void;
  onOpen: (id: number) => void;
  onNewProject: () => void;
}) {
  const active = projects.filter((p) => p.status !== "Done");
  const live = active;
  const stale = projects.filter(isStale);
  const blocked = projects.filter((p) => p.status === "Blocked");
  const blockedMvpItems = Object.values(mvpProgress).reduce(
    (sum, p) => sum + p.blocked.length,
    0
  );

  // "Needs attention today" = blocked, stale, or inside its deadline window.
  // Time-pressured work sorts to the front so a date that's actually close
  // can't get lost behind everything else.
  const hasBlockedMvpItems = (p: Project) => (mvpProgress[p.id]?.blocked.length ?? 0) > 0;
  const timePressured = (p: Project) => {
    const d = daysUntil(p.deadline);
    return d !== null && d <= 3 && p.status !== "Done";
  };
  const attentionIds = new Set(
    [
      ...stale,
      ...blocked,
      ...projects.filter(hasBlockedMvpItems),
      ...projects.filter(timePressured),
    ].map((p) => p.id)
  );
  const attention = projects
    .filter((p) => attentionIds.has(p.id))
    .sort((a, b) => urgencyRank(a.deadline) - urgencyRank(b.deadline));

  const dueSoon = live.filter((p) => {
    const d = daysUntil(p.deadline);
    return d !== null && d <= 3;
  }).length;
  // Projects that could take a date but don't have one yet.
  const withoutDates = live.filter(
    (p) => !p.deadline.trim() && (mvpProgress[p.id]?.totalMust ?? 0) > 0
  ).length;

  if (projects.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-3xl shadow-lg shadow-emerald-500/20">
          🚀
        </div>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-zinc-900">
          Nothing tracked yet
        </h2>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500">
          Add the projects you're juggling. Point each one at its folder and a
          checklist file, and progress stops being a guess — it gets counted.
        </p>
        <button
          onClick={onNewProject}
          className="mt-5 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
        >
          Add your first project
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-500">
            {blockedMvpItems > 0
              ? `${blockedMvpItems} blocked item${blockedMvpItems === 1 ? "" : "s"} across your work`
              : "Everything you're building, in one place."}
          </p>
        </div>
        {withoutDates > 0 && (
          <button
            onClick={onSetDeadlines}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            title="Sets a tight target date on every project that doesn't have one, based on the must-haves left"
          >
            ⏱ Set my deadlines ({withoutDates})
          </button>
        )}
      </header>

      <StatsStrip
        level={level}
        shipped={shipped}
        dueSoon={dueSoon}
        stale={stale.length}
        activeCount={active.length}
      />

      {nudge && (
        <NudgeBar
          nudge={nudge}
          onOpenProject={onOpen}
          onReschedule={onReschedule}
          onDismiss={onDismissNudge}
        />
      )}

      <SetupChecklist projects={projects} />

      {attention.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Needs attention today
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {attention.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                mvpProgress={mvpProgress[p.id]}
                nextMove={movesByProject[p.id]}
                xp={xpByProjectMap[p.id]}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          All projects
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
                key={p.id}
                project={p}
                mvpProgress={mvpProgress[p.id]}
                nextMove={movesByProject[p.id]}
                xp={xpByProjectMap[p.id]}
                onOpen={onOpen}
              />
          ))}
        </div>
      </section>
    </div>
  );
}

import type { Project } from "../types";
import type { MvpProgress } from "../mvp/diff";
import type { NextMove } from "../mvp/nextMove";
import { ProjectCard } from "../components/ProjectCard";
import { SetupChecklist } from "../components/SetupChecklist";
import { NudgeBar } from "../components/NudgeBar";
import type { Nudge } from "../lib/nudge";
import { urgencyRank, daysUntil } from "../lib/deadline";
import { isStale } from "../lib/time";

export function Dashboard({
  projects,
  mvpProgress,
  movesByProject,
  nudge,
  onReschedule,
  onDismissNudge,
  onOpen,
  onNewProject,
}: {
  projects: Project[];
  mvpProgress: Record<number, MvpProgress>;
  movesByProject: Record<number, NextMove>;
  nudge: Nudge | null;
  onReschedule: (id: number) => void;
  onDismissNudge: () => void;
  onOpen: (id: number) => void;
  onNewProject: () => void;
}) {
  const active = projects.filter((p) => p.status !== "Done");
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

  if (projects.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <h2 className="text-lg font-semibold text-zinc-900">No projects yet</h2>
        <p className="mt-1 max-w-sm text-sm text-zinc-500">
          Add the projects, products, or applications you're juggling. Choose a
          project folder and MVP file to enable automatic progress tracking.
        </p>
        <button
          onClick={onNewProject}
          className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          + Add your first project
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Dashboard</h1>
          <p className="text-sm text-zinc-500">
            {active.length} active · {blocked.length} blocked · {stale.length} stale
            {blockedMvpItems > 0 && ` · ${blockedMvpItems} blocked MVP item(s)`}
          </p>
        </div>
      </header>

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
                onOpen={onOpen}
              />
          ))}
        </div>
      </section>
    </div>
  );
}

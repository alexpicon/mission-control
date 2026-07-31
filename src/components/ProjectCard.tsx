import type { Project } from "../types";
import type { MvpProgress } from "../mvp/diff";
import type { NextMove } from "../mvp/nextMove";
import { StatusBadge } from "./StatusBadge";
import { ProgressBar } from "./ProgressBar";
import { StaleTag } from "./StaleTag";
import { DeadlineBadge } from "./DeadlineBadge";
import { relativeTime } from "../lib/time";
import { urgencyOf } from "../lib/deadline";

// Left edge picks up the most urgent signal on the card, so a wall of projects
// still reads at a glance.
const EDGE: Record<string, string> = {
  overdue: "before:bg-gradient-to-b before:from-rose-500 before:to-rose-400",
  today: "before:bg-gradient-to-b before:from-orange-500 before:to-amber-400",
  soon: "before:bg-gradient-to-b before:from-amber-500 before:to-yellow-400",
  later: "before:bg-gradient-to-b before:from-emerald-500 before:to-teal-400",
  none: "before:bg-gradient-to-b before:from-zinc-200 before:to-zinc-100",
};

export function ProjectCard({
  project,
  mvpProgress,
  nextMove,
  xp,
  onOpen,
}: {
  project: Project;
  mvpProgress?: MvpProgress;
  nextMove?: NextMove;
  xp?: number;
  onOpen: (id: number) => void;
}) {
  const evidence = project.progress_mode === "evidence" && mvpProgress;
  const nextBestMove = nextMove?.title ?? project.next_step;
  const urgency = project.deadline ? urgencyOf(project.deadline) : "none";
  const edge = EDGE[project.status === "Done" ? "none" : urgency] ?? EDGE.none;
  const pct = evidence ? mvpProgress.pct : project.progress;
  const complete = pct >= 100;

  return (
    <button
      onClick={() => onOpen(project.id)}
      className={`relative flex w-full flex-col gap-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 pl-5 text-left shadow-sm transition duration-200 before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-[''] hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${edge}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate font-semibold text-zinc-900">{project.name}</h3>
          {project.is_focus === 1 && (
            <span className="shrink-0 rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Focus
            </span>
          )}
          {complete && (
            <span className="shrink-0 text-sm" title="All must-haves done">
              🏆
            </span>
          )}
        </div>
        <StatusBadge status={project.status} />
      </div>

      {/* Progress + the counts behind it, so the % is never a mystery number */}
      <div>
        {evidence ? (
          <>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    complete
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                      : "bg-gradient-to-r from-emerald-500 to-teal-400"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-700">
                {pct}%
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
              <span className="font-medium">
                {mvpProgress.doneMust}/{mvpProgress.totalMust} must-haves
              </span>
              {mvpProgress.inProgress.length > 0 && (
                <span className="text-blue-600">
                  {mvpProgress.inProgress.length} in progress
                </span>
              )}
              {mvpProgress.blocked.length > 0 && (
                <span className="text-amber-600">
                  {mvpProgress.blocked.length} blocked
                </span>
              )}
              {typeof xp === "number" && xp > 0 && (
                <span className="text-violet-600">{xp} XP</span>
              )}
            </div>
          </>
        ) : (
          <ProgressBar value={project.progress} />
        )}
      </div>

      {/* The one thing to do next */}
      <div className="rounded-lg bg-zinc-50 px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          Next
        </p>
        <p className="line-clamp-2 text-sm text-zinc-800">{nextBestMove || "—"}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <span className="text-xs text-zinc-400">
          Updated {relativeTime(project.updated_at)}
        </span>
        <div className="flex items-center gap-1.5">
          <StaleTag project={project} />
          {project.deadline && <DeadlineBadge deadline={project.deadline} />}
        </div>
      </div>
    </button>
  );
}

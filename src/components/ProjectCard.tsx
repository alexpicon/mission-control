import type { Project } from "../types";
import type { MvpProgress } from "../mvp/diff";
import { StatusBadge } from "./StatusBadge";
import { ProgressBar } from "./ProgressBar";
import { StaleTag } from "./StaleTag";
import { relativeTime } from "../lib/time";

export function ProjectCard({
  project,
  mvpProgress,
  onOpen,
}: {
  project: Project;
  mvpProgress?: MvpProgress;
  onOpen: (id: number) => void;
}) {
  const evidence = project.progress_mode === "evidence" && mvpProgress;
  const nextBestMove = evidence
    ? mvpProgress.missingMust[0]?.title ?? project.next_step
    : project.next_step;

  return (
    <button
      onClick={() => onOpen(project.id)}
      className="flex w-full flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-zinc-900">{project.name}</h3>
          {project.is_focus === 1 && (
            <span className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              Focus
            </span>
          )}
        </div>
        <StatusBadge status={project.status} />
      </div>

      {evidence ? (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${mvpProgress.pct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs tabular-nums text-zinc-500">
            {mvpProgress.pct}% MVP
          </span>
        </div>
      ) : (
        <ProgressBar value={project.progress} />
      )}

      <dl className="space-y-1 text-sm">
        {evidence ? (
          <>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-zinc-400">Blocked</dt>
              <dd className="text-zinc-700">
                {mvpProgress.blocked.length > 0 ? `${mvpProgress.blocked.length} item(s)` : "—"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-zinc-400">Next</dt>
              <dd className="text-zinc-700">{nextBestMove || "—"}</dd>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-zinc-400">Blocker</dt>
              <dd className="text-zinc-700">{project.blocker || "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-zinc-400">Next</dt>
              <dd className="text-zinc-700">{project.next_step || "—"}</dd>
            </div>
          </>
        )}
      </dl>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-zinc-400">
          Updated {relativeTime(project.updated_at)}
        </span>
        <StaleTag project={project} />
      </div>
    </button>
  );
}

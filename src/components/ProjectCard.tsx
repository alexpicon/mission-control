import type { Project } from "../types";
import { StatusBadge } from "./StatusBadge";
import { ProgressBar } from "./ProgressBar";
import { StaleTag } from "./StaleTag";
import { relativeTime } from "../lib/time";

export function ProjectCard({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: (id: number) => void;
}) {
  return (
    <button
      onClick={() => onOpen(project.id)}
      className="flex w-full flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition hover:border-zinc-300 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
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

      <ProgressBar value={project.progress} />

      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-zinc-400">Blocker</dt>
          <dd className="text-zinc-700">{project.blocker || "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-zinc-400">Next</dt>
          <dd className="text-zinc-700">{project.next_step || "—"}</dd>
        </div>
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

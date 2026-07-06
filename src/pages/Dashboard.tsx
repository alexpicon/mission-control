import type { Project } from "../types";
import { ProjectCard } from "../components/ProjectCard";
import { isStale } from "../lib/time";

export function Dashboard({
  projects,
  onOpen,
  onNewProject,
}: {
  projects: Project[];
  onOpen: (id: number) => void;
  onNewProject: () => void;
}) {
  const active = projects.filter((p) => p.status !== "Done");
  const stale = projects.filter(isStale);
  const blocked = projects.filter((p) => p.status === "Blocked");

  // "Needs attention today" = blocked or stale, de-duplicated.
  const attentionIds = new Set([...stale, ...blocked].map((p) => p.id));
  const attention = projects.filter((p) => attentionIds.has(p.id));

  if (projects.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center">
        <h2 className="text-lg font-semibold text-zinc-900">No projects yet</h2>
        <p className="mt-1 max-w-sm text-sm text-zinc-500">
          Add the projects, products, or applications you're juggling. The
          dashboard flags what's stale and what's blocked.
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
            {active.length} active · {blocked.length} blocked · {stale.length}{" "}
            stale
          </p>
        </div>
      </header>

      {attention.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Needs attention today
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {attention.map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={onOpen} />
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
            <ProjectCard key={p.id} project={p} onOpen={onOpen} />
          ))}
        </div>
      </section>
    </div>
  );
}

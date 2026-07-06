import type { Project } from "../types";
import { staleLabel } from "../lib/time";

// Renders nothing if the project is not stale.
export function StaleTag({ project }: { project: Project }) {
  const label = staleLabel(project);
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-200">
      <span aria-hidden>●</span>
      {label}
    </span>
  );
}

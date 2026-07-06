import type { Status } from "../types";

const STYLES: Record<Status, string> = {
  Moving: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Blocked: "bg-amber-50 text-amber-700 ring-amber-200",
  Done: "bg-zinc-100 text-zinc-600 ring-zinc-200",
  Idea: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}

import type { Nudge } from "../lib/nudge";

const TONE: Record<Nudge["tone"], { box: string; label: string; text: string }> = {
  urgent: {
    box: "border-rose-200 bg-gradient-to-br from-rose-50/80 to-white",
    label: "text-rose-700",
    text: "On the clock",
  },
  close: {
    box: "border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white",
    label: "text-emerald-700",
    text: "Almost there",
  },
  quiet: {
    box: "border-amber-200 bg-gradient-to-br from-amber-50/70 to-white",
    label: "text-amber-700",
    text: "Gone quiet",
  },
};

// A single nudge, always naming a real project and a real next action.
// Dismissible, and an overdue nudge offers to move the date instead of
// implying failure — a missed date is information, not a verdict.
export function NudgeBar({
  nudge,
  onOpenProject,
  onReschedule,
  onDismiss,
}: {
  nudge: Nudge;
  onOpenProject: (id: number) => void;
  onReschedule: (id: number) => void;
  onDismiss: () => void;
}) {
  const tone = TONE[nudge.tone];

  return (
    <div className={`rounded-2xl border p-4 ${tone.box}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-semibold uppercase tracking-wide ${tone.label}`}>
            {tone.text}
          </p>
          <p className="mt-0.5 text-base font-semibold leading-snug text-zinc-900">
            {nudge.headline}
          </p>
          {nudge.action && (
            <p className="mt-1 text-sm text-zinc-600">
              Next: <span className="font-medium text-zinc-800">{nudge.action}</span>
            </p>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss for now"
          className="shrink-0 rounded px-1.5 py-0.5 text-zinc-400 transition hover:bg-white/70 hover:text-zinc-600"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onOpenProject(nudge.projectId)}
          className="rounded-lg bg-gradient-to-br from-zinc-900 to-zinc-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
        >
          Open it
        </button>
        {nudge.offerReschedule && (
          <button
            onClick={() => onReschedule(nudge.projectId)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Move the date
          </button>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import type { NextMove, ProjectSnapshot } from "../mvp/nextMove";
import { aiNextMove } from "../ai/nextMove";
import { hasApiKey } from "../ai/provider";

const PRIORITY_LABEL: Record<string, string> = {
  must_have: "must-have",
  should_have: "should-have",
  nice_to_have: "nice-to-have",
};

// The app's core answer: the ONE task to do next, and why. The deterministic
// pick renders instantly; "Deep read" swaps in the AI's portfolio-aware call
// plus a concrete first step.
export function NextMoveCard({
  move,
  snapshots,
  onOpenProject,
}: {
  move: NextMove | null;
  snapshots: ProjectSnapshot[];
  onOpenProject: (projectId: number) => void;
}) {
  const [aiMove, setAiMove] = useState<NextMove | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const shown = aiMove ?? move;

  async function deepRead() {
    setBusy(true);
    setNote(null);
    try {
      if (!(await hasApiKey())) {
        setNote("Add an Anthropic API key in Settings for the AI read.");
        return;
      }
      const result = await aiNextMove(snapshots);
      if (result) setAiMove(result);
      else setNote("Couldn't get a confident read — sticking with the pick above.");
    } finally {
      setBusy(false);
    }
  }

  if (!shown) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Next best move</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Nothing open — every tracked task is done or cut. Add goals to a project's
          checklist to get a new target.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Next best move
        </h2>
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-zinc-500 ring-1 ring-inset ring-zinc-200">
          {shown.source === "ai" ? "AI read" : "auto"}
        </span>
      </div>

      <p className="mt-1.5 text-lg font-semibold leading-snug text-zinc-900">
        {shown.title}
      </p>
      <p className="text-sm text-zinc-500">
        {shown.projectName} · {PRIORITY_LABEL[shown.priority] ?? shown.priority}
      </p>

      {shown.reason && <p className="mt-2 text-sm text-zinc-700">{shown.reason}</p>}

      {shown.firstStep && (
        <div className="mt-2 rounded-lg bg-white/70 p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Start with
          </p>
          <p className="text-sm text-zinc-800">{shown.firstStep}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onOpenProject(shown.projectId)}
          className="rounded-lg bg-gradient-to-br from-zinc-900 to-zinc-700 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
        >
          Open {shown.projectName}
        </button>
        <button
          onClick={deepRead}
          disabled={busy}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40"
        >
          {busy ? "Reading…" : aiMove ? "Re-read" : "Deep read (AI)"}
        </button>
        {note && <span className="text-xs text-zinc-500">{note}</span>}
      </div>
    </div>
  );
}

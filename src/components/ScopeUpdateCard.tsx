import { useMemo, useState } from "react";
import type { MvpScopeDiff, Project, ProposedScopeUpdate } from "../types";
import { setScopeUpdateStatus } from "../db";
import { applyScopeUpdate } from "../mvp/sync";

export function ScopeUpdateCard({
  update,
  project,
  onResolved,
}: {
  update: ProposedScopeUpdate;
  project: Project;
  onResolved: () => void;
}) {
  const diff = useMemo(() => JSON.parse(update.diff_json) as MvpScopeDiff, [update.diff_json]);
  const [addSel, setAddSel] = useState<Set<string>>(new Set(diff.added.map((a) => a.title)));
  const [removeSel, setRemoveSel] = useState<Set<string>>(
    new Set(diff.removed.map((r) => r.title))
  );
  const [busy, setBusy] = useState(false);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, title: string) {
    const next = new Set(set);
    if (next.has(title)) next.delete(title);
    else next.add(title);
    setter(next);
  }

  async function approve() {
    setBusy(true);
    try {
      await applyScopeUpdate(update.id, project, { addTitles: addSel, removeTitles: removeSel });
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await setScopeUpdateStatus(update.id, "rejected");
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">
          MVP file changed{diff.usedAi ? " · AI-extracted" : ""}
        </span>
        <span className="text-xs font-medium text-zinc-500">
          Progress impact: {update.old_progress}% → {update.new_progress}%
        </span>
      </div>

      {diff.added.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-zinc-500">Added</p>
          <ul className="mt-1 space-y-1">
            {diff.added.map((a) => (
              <li key={a.title} className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={addSel.has(a.title)}
                  onChange={() => toggle(addSel, setAddSel, a.title)}
                  className="accent-violet-600"
                />
                {a.title}
                <span className="text-xs text-zinc-400">({a.priority.replace("_", "-")})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.removed.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-zinc-500">Removed (will be marked cut)</p>
          <ul className="mt-1 space-y-1">
            {diff.removed.map((r) => (
              <li key={r.title} className="flex items-center gap-2 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  checked={removeSel.has(r.title)}
                  onChange={() => toggle(removeSel, setRemoveSel, r.title)}
                  className="accent-violet-600"
                />
                {r.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {diff.changed.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-semibold text-zinc-500">Changed</p>
          <ul className="mt-1 space-y-0.5 text-sm text-zinc-800">
            {diff.changed.map((c) => (
              <li key={c.title}>
                {c.title}: {c.before.priority.replace("_", "-")} → {c.after.priority.replace("_", "-")}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={approve}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          Approve
        </button>
        <button
          onClick={reject}
          disabled={busy}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
        >
          Reject
        </button>
      </div>
    </li>
  );
}

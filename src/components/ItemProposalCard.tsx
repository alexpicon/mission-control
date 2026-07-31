import { useState } from "react";
import type { MvpItem, MvpItemStatus, ProposedItemUpdate } from "../types";
import { MVP_ITEM_STATUSES } from "../types";
import { approveItemUpdate, setItemUpdateStatus } from "../db";

const CONFIDENCE_STYLES: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-500",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-emerald-50 text-emerald-700",
};

export function ItemProposalCard({
  update,
  item,
  onResolved,
}: {
  update: ProposedItemUpdate;
  item: MvpItem;
  onResolved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<MvpItemStatus>(update.suggested_status);
  const [busy, setBusy] = useState(false);

  // Evidence is stored as "Files changed:\n- path\n- path"; show a few inline
  // and hide the rest, so a 25-file session doesn't swamp the card.
  const files = update.evidence
    .split("\n")
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim());

  async function approve(applyStatus: MvpItemStatus) {
    setBusy(true);
    try {
      await approveItemUpdate(update.id, applyStatus);
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await setItemUpdateStatus(update.id, "rejected");
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
          {update.source === "claude-code" ? "From Claude Code" : "From folder scan"}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CONFIDENCE_STYLES[update.confidence]}`}>
          Confidence: {update.confidence}
        </span>
      </div>

      <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
      <p className="mt-0.5 text-sm text-zinc-600">
        Suggested status:{" "}
        <span className="font-medium">{update.suggested_status.replace("_", " ")}</span>
      </p>

      {files.length > 0 && (
        <div className="mt-2 rounded-lg bg-white/70 p-2">
          <p className="text-[11px] text-zinc-500">
            {files.slice(0, 3).join(", ")}
            {files.length > 3 && (
              <span className="text-zinc-400"> and {files.length - 3} more</span>
            )}
          </p>
          {files.length > 3 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] text-zinc-400 hover:text-zinc-600">
                see all {files.length} files
              </summary>
              <ul className="mt-1 space-y-0.5">
                {files.map((f) => (
                  <li key={f} className="truncate text-[11px] text-zinc-500">
                    {f}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as MvpItemStatus)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-zinc-500"
          >
            {MVP_ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          <button
            onClick={() => approve(status)}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            Save & approve
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => approve(update.suggested_status)}
            disabled={busy}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            Approve
          </button>
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
          >
            Edit
          </button>
          <button
            onClick={reject}
            disabled={busy}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      )}
    </li>
  );
}

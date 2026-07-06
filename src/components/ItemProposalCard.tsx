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

      {update.evidence && (
        <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-white/70 p-2 font-sans text-xs text-zinc-600">
          {update.evidence}
        </pre>
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

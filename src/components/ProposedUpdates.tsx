import { useEffect, useState } from "react";
import type { ProposedUpdate } from "../types";
import {
  listPendingProposed,
  approveProposedUpdate,
  setProposedStatus,
  updateProposedContent,
} from "../db";
import { relativeTime } from "../lib/time";

// Review queue for Claude Code proposed updates. Nothing here is applied to
// project memory until the user explicitly approves.
export function ProposedUpdates({
  projectId,
  onApplied,
}: {
  projectId: number;
  onApplied: () => void;
}) {
  const [items, setItems] = useState<ProposedUpdate[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  async function load() {
    setItems(await listPendingProposed(projectId));
  }

  // Poll so updates from a running Claude Code session appear without a manual refresh.
  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function approve(p: ProposedUpdate) {
    await approveProposedUpdate(p.id);
    await load();
    onApplied(); // refresh timeline + dashboard staleness
  }

  async function reject(p: ProposedUpdate) {
    await setProposedStatus(p.id, "rejected");
    await load();
  }

  function startEdit(p: ProposedUpdate) {
    setEditingId(p.id);
    setDraft(p.summary);
  }

  async function saveEdit(p: ProposedUpdate) {
    await updateProposedContent(p.id, draft, p.files_changed);
    setEditingId(null);
    await load();
  }

  if (items.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Proposed updates
        <span className="rounded-full bg-blue-100 px-1.5 text-[10px] font-semibold text-blue-700">
          {items.length}
        </span>
      </h2>

      <ul className="space-y-3">
        {items.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-blue-200 bg-blue-50/40 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                From Claude Code · {relativeTime(p.created_at)}
              </span>
            </div>

            {editingId === p.id ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.min(16, draft.split("\n").length + 1)}
                className="w-full rounded-lg border border-zinc-300 bg-white p-3 font-mono text-xs text-zinc-800 outline-none focus:border-zinc-500"
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-800">
                {p.summary}
              </pre>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {editingId === p.id ? (
                <>
                  <button
                    onClick={() => saveEdit(p)}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => approve(p)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => startEdit(p)}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => reject(p)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

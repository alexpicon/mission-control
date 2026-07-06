import { useEffect, useState } from "react";
import type { MvpItem, Project, ProposedItemUpdate, ProposedScopeUpdate } from "../types";
import {
  listMvpItems,
  listPendingScopeUpdates,
  listPendingItemUpdates,
} from "../db";
import { checkMvpFile, scanFolder } from "../mvp/sync";
import { computeMvpProgress } from "../mvp/diff";
import { MvpChecklist } from "./MvpChecklist";
import { ScopeUpdateCard } from "./ScopeUpdateCard";
import { ItemProposalCard } from "./ItemProposalCard";

export function MvpSection({
  project,
  onProjectChanged,
}: {
  project: Project;
  onProjectChanged: () => void; // reload the Project object (mvp_file_hash/progress_mode may change)
}) {
  const [items, setItems] = useState<MvpItem[]>([]);
  const [scopeUpdates, setScopeUpdates] = useState<ProposedScopeUpdate[]>([]);
  const [itemUpdates, setItemUpdates] = useState<ProposedItemUpdate[]>([]);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [folderMsg, setFolderMsg] = useState<string | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);

  async function load() {
    const [i, s, u] = await Promise.all([
      listMvpItems(project.id),
      listPendingScopeUpdates(project.id),
      listPendingItemUpdates(project.id),
    ]);
    setItems(i);
    setScopeUpdates(s);
    setItemUpdates(u);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function runScan() {
    setScanBusy(true);
    setScanMsg(null);
    try {
      const res = await checkMvpFile(project);
      onProjectChanged();
      await load();
      if (res.status === "no_path") setScanMsg("No MVP file connected yet.");
      else if (res.status === "not_found") setScanMsg(`Error: ${res.message}`);
      else if (res.status === "unchanged") setScanMsg("Up to date — no changes since last scan.");
      else if (res.status === "no_items_found") setScanMsg(res.message);
      else if (res.status === "proposed") setScanMsg("Found changes — review the proposed scope update below.");
    } finally {
      setScanBusy(false);
    }
  }

  async function runFolderScan() {
    setFolderBusy(true);
    setFolderMsg(null);
    try {
      const res = await scanFolder(project);
      await load();
      setFolderMsg(
        res.changedCount === 0
          ? "No tracked file changes since last scan."
          : `${res.changedCount} changed file(s) found. Check proposed updates below.`
      );
    } finally {
      setFolderBusy(false);
    }
  }

  const progress = computeMvpProgress(items);
  const itemsById = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-zinc-900">MVP file</h2>
            <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
              {project.mvp_file_path || "Not connected"}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
              project.progress_mode === "evidence"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-zinc-100 text-zinc-500 ring-zinc-200"
            }`}
          >
            {project.progress_mode === "evidence" ? "Evidence mode" : "Manual mode"}
          </span>
        </div>

        {!project.mvp_file_path ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Add an MVP file path (Edit → MVP file path) — e.g. docs/MVP.md — then scan it.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={runScan}
              disabled={scanBusy}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40"
            >
              {scanBusy ? "Scanning…" : "Scan MVP file"}
            </button>
            {project.path && (
              <button
                onClick={runFolderScan}
                disabled={folderBusy}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              >
                {folderBusy ? "Scanning folder…" : "Scan folder for evidence"}
              </button>
            )}
          </div>
        )}

        {scanMsg && <p className="mt-2 text-sm text-zinc-600">{scanMsg}</p>}
        {folderMsg && <p className="mt-1 text-sm text-zinc-500">{folderMsg}</p>}
      </div>

      {scopeUpdates.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Proposed scope updates
            <span className="rounded-full bg-violet-100 px-1.5 text-[10px] font-semibold text-violet-700">
              {scopeUpdates.length}
            </span>
          </h3>
          <ul className="space-y-3">
            {scopeUpdates.map((u) => (
              <ScopeUpdateCard
                key={u.id}
                update={u}
                project={project}
                onResolved={async () => {
                  onProjectChanged();
                  await load();
                }}
              />
            ))}
          </ul>
        </section>
      )}

      {itemUpdates.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Proposed progress updates
            <span className="rounded-full bg-blue-100 px-1.5 text-[10px] font-semibold text-blue-700">
              {itemUpdates.length}
            </span>
          </h3>
          <ul className="space-y-3">
            {itemUpdates.map((u) => {
              const item = itemsById.get(u.mvp_item_id);
              if (!item) return null;
              return (
                <ItemProposalCard key={u.id} update={u} item={item} onResolved={load} />
              );
            })}
          </ul>
        </section>
      )}

      {items.length > 0 && (
        <MvpChecklist items={items} progress={progress} onChanged={load} />
      )}
    </div>
  );
}

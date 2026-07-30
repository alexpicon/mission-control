import { useEffect, useState } from "react";
import type {
  MvpItem,
  MvpPriority,
  Project,
  ProposedItemUpdate,
  ProposedScopeUpdate,
  ShipEvent,
  ShipResult,
  UnlockedAchievement,
} from "../types";
import {
  listMvpItems,
  listPendingScopeUpdates,
  listPendingItemUpdates,
  listShipEventsForProject,
  listUnlockedAchievements,
} from "../db";
import { checkMvpFile, scanFolder } from "../mvp/sync";
import { logShippedWin } from "../xp/ship";
import { computeMvpProgress } from "../mvp/diff";
import { relativeTime } from "../lib/time";
import { MvpChecklist } from "./MvpChecklist";
import { ScopeUpdateCard } from "./ScopeUpdateCard";
import { ItemProposalCard } from "./ItemProposalCard";
import { Achievements } from "./Achievements";

export function MvpSection({
  project,
  onProjectChanged,
  onShipped,
}: {
  project: Project;
  onProjectChanged: () => void; // reload the Project object (mvp_file_hash/progress_mode may change)
  onShipped: (r: ShipResult) => void; // bubble a ship up for celebration + XP refresh
}) {
  const [items, setItems] = useState<MvpItem[]>([]);
  const [scopeUpdates, setScopeUpdates] = useState<ProposedScopeUpdate[]>([]);
  const [itemUpdates, setItemUpdates] = useState<ProposedItemUpdate[]>([]);
  const [shipEvents, setShipEvents] = useState<ShipEvent[]>([]);
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [folderMsg, setFolderMsg] = useState<string | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);
  const [winTitle, setWinTitle] = useState("");
  const [winPriority, setWinPriority] = useState<MvpPriority>("should_have");
  const [winBusy, setWinBusy] = useState(false);

  async function load() {
    const [i, s, u, se, ach] = await Promise.all([
      listMvpItems(project.id),
      listPendingScopeUpdates(project.id),
      listPendingItemUpdates(project.id),
      listShipEventsForProject(project.id),
      listUnlockedAchievements(),
    ]);
    setItems(i);
    setScopeUpdates(s);
    setItemUpdates(u);
    setShipEvents(se);
    setUnlocked(ach);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // A ship happened inside this section — refresh local state AND bubble up.
  function handleShipped(r: ShipResult) {
    onShipped(r);
    load();
  }

  async function runScan() {
    setScanBusy(true);
    setScanMsg(null);
    try {
      const res = await checkMvpFile(project);
      res.shipResults.forEach(onShipped); // celebrate any auto-shipped checkboxes
      onProjectChanged();
      await load();
      const shippedCount = res.shipResults.filter((r) => r.shipped).length;
      const shippedNote = shippedCount > 0 ? `Auto-shipped ${shippedCount} checked item(s). ` : "";
      if (res.status === "no_path") setScanMsg("No MVP file connected yet.");
      else if (res.status === "not_found") setScanMsg(`Error: ${res.message}`);
      else if (res.status === "no_items_found") setScanMsg(res.message ?? "No items found.");
      else if (res.status === "proposed")
        setScanMsg(`${shippedNote}Scope changed — review the proposed update below.`);
      else setScanMsg(`${shippedNote || "Up to date — no changes since last scan."}`);
    } finally {
      setScanBusy(false);
    }
  }

  async function logWin() {
    const title = winTitle.trim();
    if (!title) return;
    setWinBusy(true);
    try {
      const r = await logShippedWin(project, title, winPriority);
      setWinTitle("");
      handleShipped(r);
    } finally {
      setWinBusy(false);
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

      {/* Log a win — a shipped bug fix / small thing that wasn't a planned item. */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Log a win</h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          Shipped a fix or a small thing that isn't on the checklist? Log it — it earns XP.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={winTitle}
            onChange={(e) => setWinTitle(e.target.value)}
            placeholder="e.g. Fixed the widget drag glitch"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
          />
          <select
            value={winPriority}
            onChange={(e) => setWinPriority(e.target.value as MvpPriority)}
            className="rounded-lg border border-zinc-300 px-2 py-2 text-sm outline-none focus:border-zinc-500"
            aria-label="Win size"
          >
            <option value="must_have">Big (50 XP)</option>
            <option value="should_have">Medium (25 XP)</option>
            <option value="nice_to_have">Small (10 XP)</option>
          </select>
          <button
            onClick={logWin}
            disabled={winBusy || !winTitle.trim()}
            className="rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-110 active:scale-95 disabled:opacity-40"
          >
            Ship it 🚀
          </button>
        </div>
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
        <MvpChecklist
          items={items}
          progress={progress}
          project={project}
          onChanged={load}
          onShipped={handleShipped}
        />
      )}

      {shipEvents.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-900">Recently shipped</h3>
          <ul className="space-y-1.5">
            {shipEvents.slice(0, 8).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-zinc-700">✓ {e.title}</span>
                <span className="shrink-0 text-xs text-zinc-400">
                  +{e.xp} XP · {relativeTime(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Achievements unlocked={unlocked} projectId={project.id} />
    </div>
  );
}

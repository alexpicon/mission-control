import { useState } from "react";
import type { MvpItem, MvpItemStatus, MvpPriority, Project, ShipResult } from "../types";
import { MVP_ITEM_STATUSES } from "../types";
import type { MvpProgress } from "../mvp/diff";
import { setMvpItemStatus } from "../db";
import { shipMvpItem } from "../xp/ship";

const PRIORITY_LABEL: Record<MvpPriority, string> = {
  must_have: "Must have",
  should_have: "Should have",
  nice_to_have: "Nice to have",
};

const STATUS_STYLES: Record<MvpItemStatus, string> = {
  not_started: "bg-zinc-100 text-zinc-500",
  in_progress: "bg-blue-50 text-blue-700",
  blocked: "bg-amber-50 text-amber-700",
  done: "bg-emerald-50 text-emerald-700",
  cut: "bg-zinc-100 text-zinc-400 line-through",
};

const STATUS_LABEL: Record<MvpItemStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  cut: "Cut",
};

function Row({
  item,
  project,
  onChanged,
  onShipped,
}: {
  item: MvpItem;
  project: Project;
  onChanged: () => void;
  onShipped: (r: ShipResult) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function changeStatus(status: MvpItemStatus) {
    setBusy(true);
    try {
      await setMvpItemStatus(item.id, status);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function ship() {
    setBusy(true);
    try {
      const result = await shipMvpItem(item, project);
      onShipped(result);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const shippable = item.status !== "done" && item.status !== "cut";

  return (
    <li className="flex items-start justify-between gap-3 border-b border-zinc-100 py-2 last:border-0">
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm text-zinc-800 ${item.status === "cut" ? "text-zinc-400 line-through" : ""}`}
        >
          {item.title}
        </p>
        {item.evidence && (
          <p className="mt-0.5 truncate text-xs text-zinc-400" title={item.evidence}>
            {item.evidence.split("\n")[0]}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {shippable && (
          <button
            onClick={ship}
            disabled={busy}
            className="rounded-md bg-gradient-to-br from-emerald-500 to-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-95 disabled:opacity-40"
          >
            Ship it 🚀
          </button>
        )}
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
        <select
          value={item.status}
          disabled={busy}
          onChange={(e) => changeStatus(e.target.value as MvpItemStatus)}
          className="rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-xs text-zinc-600 outline-none focus:border-zinc-400 disabled:opacity-40"
          aria-label={`Set status for ${item.title}`}
        >
          {MVP_ITEM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}

export function MvpChecklist({
  items,
  progress,
  project,
  onChanged,
  onShipped,
}: {
  items: MvpItem[];
  progress: MvpProgress;
  project: Project;
  onChanged: () => void;
  onShipped: (r: ShipResult) => void;
}) {
  const groups: { priority: MvpPriority; items: MvpItem[] }[] = (
    ["must_have", "should_have", "nice_to_have"] as MvpPriority[]
  ).map((priority) => ({ priority, items: items.filter((i) => i.priority === priority) }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-emerald-50/40 p-4">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">
            MVP Progress: <span className="tabular-nums">{progress.pct}%</span>
          </h3>
          <span className="text-xs text-zinc-400">
            {progress.doneMust} / {progress.totalMust} must-haves
          </span>
        </div>

        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-700 ease-out"
            style={{ width: `${progress.pct}%` }}
          />
        </div>

        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-zinc-500 sm:grid-cols-2">
          <span>Should-have: {progress.should.done}/{progress.should.total} done</span>
          <span>Nice-to-have: {progress.nice.done}/{progress.nice.total} done</span>
        </div>

        {progress.inProgress.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              In progress
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-zinc-700">
              {progress.inProgress.map((i) => (
                <li key={i.id}>- {i.title}</li>
              ))}
            </ul>
          </div>
        )}

        {progress.blocked.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
              Blocked
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-zinc-700">
              {progress.blocked.map((i) => (
                <li key={i.id}>- {i.title}</li>
              ))}
            </ul>
          </div>
        )}

        {progress.missingMust.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Missing (must-have)
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-zinc-700">
              {progress.missingMust.map((i) => (
                <li key={i.id}>- {i.title}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-zinc-900">Checklist</h3>
        {groups.map(
          (g) =>
            g.items.length > 0 && (
              <div key={g.priority} className="mt-3 first:mt-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {PRIORITY_LABEL[g.priority]}
                </p>
                <ul>
                  {g.items.map((item) => (
                    <Row
                      key={item.id}
                      item={item}
                      project={project}
                      onChanged={onChanged}
                      onShipped={onShipped}
                    />
                  ))}
                </ul>
              </div>
            )
        )}
      </div>
    </div>
  );
}

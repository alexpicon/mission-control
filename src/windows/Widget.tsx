import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Project } from "../types";
import { computeMvpProgress, type MvpProgress } from "../mvp/diff";
import { loadSnapshots, pickNextMove, type NextMove } from "../mvp/nextMove";
import { listProjects } from "../db";
import { loadXpSummary } from "../xp/summary";
import { isStale } from "../lib/time";
import type { LevelInfo } from "../xp/model";
import { levelInfo } from "../xp/model";

interface Row {
  project: Project;
  pct: number;
  stale: boolean;
  blocked: boolean;
}

// Always-on-top leaderboard overlay. Shows the portfolio Level + every project
// ranked by MVP %. Polls the local DB so it stays live while it floats over
// your other apps.
export function Widget() {
  const [rows, setRows] = useState<Row[]>([]);
  const [level, setLevel] = useState<LevelInfo>(levelInfo(0));
  const [move, setMove] = useState<NextMove | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function tick() {
      const projects = await listProjects();
      const [xp, snaps] = await Promise.all([loadXpSummary(), loadSnapshots(projects)]);
      if (!active) return;

      const mvp: Record<number, MvpProgress> = {};
      for (const s of snaps) {
        if (s.project.progress_mode === "evidence") {
          mvp[s.project.id] = computeMvpProgress(s.items);
        }
      }
      setMove(pickNextMove(snaps));

      const built: Row[] = projects.map((p) => {
        const prog: MvpProgress | undefined = mvp[p.id];
        const pct = p.progress_mode === "evidence" && prog ? prog.pct : p.progress;
        return {
          project: p,
          pct,
          stale: isStale(p),
          blocked: p.status === "Blocked" || (prog?.blocked.length ?? 0) > 0,
        };
      });
      // Rank: things needing attention first (blocked/stale), then by % descending.
      built.sort((a, b) => {
        const aAttn = a.blocked || a.stale ? 1 : 0;
        const bAttn = b.blocked || b.stale ? 1 : 0;
        if (aAttn !== bAttn) return bAttn - aAttn;
        return b.pct - a.pct;
      });
      setRows(built);
      setLevel(xp.level);
      setLoaded(true);
    }
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  function hide() {
    getCurrentWindow().hide();
  }

  return (
    <div className="widget-root flex h-screen flex-col rounded-xl border border-zinc-200 bg-white">
      {/* Drag handle / header */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between border-b border-zinc-100 px-3 py-2"
      >
        <span data-tauri-drag-region className="flex items-center gap-1.5">
          <span className="text-sm">🚀</span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Mission Control
          </span>
        </span>
        <button
          onClick={hide}
          aria-label="Hide overlay"
          className="rounded px-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          ✕
        </button>
      </div>

      {/* Level */}
      <div className="border-b border-zinc-100 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="grid h-5 w-5 place-items-center rounded bg-gradient-to-br from-emerald-500 to-teal-500 text-[10px] font-bold text-white">
              {level.level}
            </span>
            <span className="text-xs font-semibold text-zinc-900">Level {level.level}</span>
          </div>
          <span className="text-[11px] tabular-nums text-zinc-400">{level.totalXp} XP</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-[width] duration-500"
            style={{ width: `${level.pctToNext}%` }}
          />
        </div>
      </div>

      {/* Next best move — the one thing to do right now */}
      {move && (
        <div className="border-b border-zinc-100 bg-emerald-50/50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            Do this next
          </p>
          <p className="mt-0.5 text-xs font-semibold leading-snug text-zinc-900">
            {move.title}
          </p>
          <p className="truncate text-[11px] text-zinc-500">{move.projectName}</p>
        </div>
      )}

      {/* Ranked projects */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1.5">
        {!loaded ? (
          <p className="px-1.5 py-2 text-xs text-zinc-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="px-1.5 py-2 text-xs text-zinc-400">No projects yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {rows.map(({ project, pct, stale, blocked }) => (
              <li
                key={project.id}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-zinc-50"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    blocked ? "bg-amber-500" : stale ? "bg-orange-400" : pct >= 100 ? "bg-emerald-500" : "bg-zinc-300"
                  }`}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-800">
                  {project.name}
                </span>
                <span className="shrink-0 text-[11px] font-medium tabular-nums text-zinc-500">
                  {pct}%
                </span>
                <span className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-zinc-100">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                    style={{ width: `${pct}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

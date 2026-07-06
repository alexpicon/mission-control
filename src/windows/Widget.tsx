import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Project } from "../types";
import { getFocusProject } from "../db";
import { StatusBadge } from "../components/StatusBadge";
import { staleLabel } from "../lib/time";

// Always-on-top companion window. Shows the single focus project.
// Polls the local DB so it stays in sync when the main app changes focus.
export function Widget() {
  const [project, setProject] = useState<Project | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function tick() {
      const p = await getFocusProject();
      if (active) {
        setProject(p);
        setLoaded(true);
      }
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

  const stale = project ? staleLabel(project) : null;

  return (
    <div className="widget-root flex h-screen flex-col rounded-xl border border-zinc-200 bg-white">
      {/* Drag handle / header */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between border-b border-zinc-100 px-3 py-2"
      >
        <span
          data-tauri-drag-region
          className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400"
        >
          Mission Control
        </span>
        <button
          onClick={hide}
          aria-label="Hide widget"
          className="rounded px-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-hidden px-3 py-2.5">
        {!loaded ? (
          <p className="text-sm text-zinc-400">Loading…</p>
        ) : !project ? (
          <div className="flex h-full flex-col justify-center text-center">
            <p className="text-sm font-medium text-zinc-700">No focus project</p>
            <p className="mt-1 text-xs text-zinc-400">
              Open a project → "Set as focus".
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h1 className="truncate text-sm font-semibold text-zinc-900">
                {project.name}
              </h1>
              <StatusBadge status={project.status} />
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Next
              </div>
              <p className="truncate text-sm text-zinc-800">
                {project.next_step || "—"}
              </p>
            </div>

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Blocker
              </div>
              <p className="truncate text-sm text-zinc-800">
                {project.blocker || "none"}
              </p>
            </div>

            {stale && (
              <p className="truncate text-xs font-medium text-orange-600">
                {stale}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

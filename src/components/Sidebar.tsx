import type { View, Nav } from "../nav";
import type { LevelInfo } from "../xp/model";
import { LevelBadge } from "./LevelBadge";

const NAV: { label: string; view: View }[] = [
  { label: "Dashboard", view: { name: "dashboard" } },
  { label: "Chat", view: { name: "chat" } },
  { label: "Audit", view: { name: "audit" } },
  { label: "Settings", view: { name: "settings" } },
];

export function Sidebar({
  current,
  navigate,
  onNewProject,
  onToggleWidget,
  widgetOn,
  level,
  pulseKey,
}: {
  current: View["name"];
  navigate: Nav;
  onNewProject: () => void;
  onToggleWidget: () => void;
  widgetOn: boolean;
  level: LevelInfo;
  pulseKey: number;
}) {
  return (
    <aside className="relative z-30 flex w-56 shrink-0 flex-col overflow-visible border-r border-zinc-200 bg-white/70 px-3 py-4 backdrop-blur">
      <div className="flex items-center gap-2 px-1 pb-4">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-base shadow-sm">
          🚀
        </span>
        <div>
          <div className="text-sm font-semibold text-zinc-900">Mission Control</div>
          <div className="text-[11px] text-zinc-400">Ship more. Guess less.</div>
        </div>
      </div>

      <button
        onClick={onNewProject}
        className="mb-3 rounded-lg bg-gradient-to-br from-zinc-900 to-zinc-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
      >
        + New project
      </button>

      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const active = current === item.view.name;
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.view)}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                active
                  ? "bg-zinc-100 text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-2 pt-4">
        <LevelBadge level={level} pulseKey={pulseKey} />
        <button
          onClick={onToggleWidget}
          className="flex w-full items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          <span>Floating widget</span>
          <span
            className={`text-xs font-medium ${
              widgetOn ? "text-emerald-600" : "text-zinc-400"
            }`}
          >
            {widgetOn ? "On" : "Off"}
          </span>
        </button>
      </div>
    </aside>
  );
}

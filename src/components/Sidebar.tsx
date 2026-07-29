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
}: {
  current: View["name"];
  navigate: Nav;
  onNewProject: () => void;
  onToggleWidget: () => void;
  widgetOn: boolean;
  level: LevelInfo;
}) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-4">
      <div className="px-2 pb-4">
        <div className="text-sm font-semibold text-zinc-900">Mission Control</div>
        <div className="text-xs text-zinc-400">Local project command center</div>
      </div>

      <button
        onClick={onNewProject}
        className="mb-3 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
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
        <LevelBadge level={level} />
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
